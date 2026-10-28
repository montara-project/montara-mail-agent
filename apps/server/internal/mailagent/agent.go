// Package mailagent runs the mail copilot: it turns a user prompt into model
// turns with tool calls, executes the tools against one mailbox, and streams
// progress to the caller. Outbound mail never leaves through the model's own
// choice — the tools only propose it, and a proposal becomes mail only after
// the user approves it (see AgentRepository.SetActionStatus).
package mailagent

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/mailsync"
	"montara-mail-agent/server/internal/models"
)

// Loop bounds: how many model turns one prompt may take, how much history
// rides along, and how much text one turn may answer with.
const (
	maxSteps        = 6
	maxHistory      = 40
	maxAnswerTokens = 2048
)

// Session is one copilot turn's context: the conversation it writes into,
// the mailbox it works on, and the email the user has attached to the turn.
type Session struct {
	Conversation models.AgentConversation
	Account      models.EmailAccount
	// MailID is only a pointer: the model reads the email through get_mail,
	// which keeps it to the bound mailbox.
	MailID string
	// Bot is the persona the turn speaks as; nil means the built-in one.
	Bot *models.AgentBot
	// Skill is the skill the user invoked for this turn with a /command.
	Skill *models.AgentSkill
}

// Event kinds streamed to the client during a run.
const (
	EventConversation  = "conversation" // Payload: the conversation the turn belongs to
	EventStatus        = "status"       // Text: what the agent is doing now
	EventTool          = "tool"         // Name + Text: a tool ran, and what it returned in short
	EventMessage       = "message"      // Text: the final markdown answer
	EventPendingAction = "action"       // Payload: the proposed outbound mail awaiting approval
	EventError         = "error"        // Text: a failure the user should see
	EventDone          = "done"
)

// Event is one streamed step of a run.
type Event struct {
	Type    string          `json:"type"`
	Name    string          `json:"name,omitempty"`
	Text    string          `json:"text,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// Run turns the user's prompt into a streamed assistant answer, persisting
// every row it produces (the prompt, the model's turns, the tool results) and
// returning the message rows written this turn. emit receives the events as
// they happen; an emit error (a disconnected client) stops the run.
func Run(ctx context.Context, app *app.Application, sync *mailsync.Syncer, s Session, prompt string, emit func(Event) error) ([]models.AgentMessage, error) {
	repo := &app.Repositories.Agent
	written := []models.AgentMessage{}

	persist := func(m *models.AgentMessage) error {
		if err := repo.InsertMessage(ctx, m); err != nil {
			return err
		}
		written = append(written, *m)
		return nil
	}

	// The user's prompt opens the turn.
	userRow := models.AgentMessage{ConversationID: s.Conversation.ID, Role: models.AgentRoleUser, Content: prompt}
	if err := persist(&userRow); err != nil {
		return written, err
	}

	rows, err := repo.Messages(ctx, s.Conversation.ID, maxHistory)
	if err != nil {
		return written, err
	}
	messages := chatHistory(rows)

	tools := newToolset(app, sync, s)
	tools.loadMCP(ctx)
	defer tools.closeMCP()
	system := systemPrompt(s)
	if len(tools.mcp.defs) > 0 {
		system += mcpRule
	}

	for step := 0; ; step++ {
		client, err := app.LLMFor(ctx, s.Conversation.OrganizationID)
		if err != nil {
			return written, err
		}
		result, err := client.Chat(ctx, llm.ChatRequest{
			System:    system,
			Messages:  messages,
			Tools:     tools.defs(),
			MaxTokens: maxAnswerTokens,
		})
		if err != nil {
			return written, err
		}

		if !result.WantsTools() {
			assistant := models.AgentMessage{
				ConversationID: s.Conversation.ID,
				Role:           models.AgentRoleAssistant,
				Content:        result.Text,
				TokensIn:       result.Usage.Input,
				TokensOut:      result.Usage.Output,
			}
			if err := persist(&assistant); err != nil {
				return written, err
			}
			if err := emit(Event{Type: EventMessage, Text: result.Text}); err != nil {
				return written, err
			}
			_ = emit(Event{Type: EventDone})
			logTurn(s, step+1, result.Usage, nil)
			return written, nil
		}

		// The model asked for tools: record the calls, run them, and feed the
		// answers back in one tool message.
		if err := persistAssistantCalls(s.Conversation.ID, result, persist); err != nil {
			return written, err
		}
		messages = append(messages, llm.ChatMessage{Role: llm.RoleAssistant, Text: result.Text, Calls: result.ToolCalls})

		results := make([]llm.ToolResult, 0, len(result.ToolCalls))
		for _, call := range result.ToolCalls {
			content, payload := tools.execute(ctx, call)
			results = append(results, llm.ToolResult{CallID: call.ID, Content: content})
			row := models.AgentMessage{
				ConversationID: s.Conversation.ID,
				Role:           models.AgentRoleTool,
				ToolName:       call.Name,
				ToolPayload:    payload,
			}
			if err := persist(&row); err != nil {
				return written, err
			}
			if err := emit(Event{Type: EventTool, Name: call.Name, Text: toolSummary(call.Name, content), Payload: payload}); err != nil {
				return written, err
			}
			// A proposal is the one tool output the user must act on, so it
			// rides its own event type.
			if strings.HasPrefix(call.Name, "propose_") && len(payload) > 0 {
				if err := emit(Event{Type: EventPendingAction, Name: call.Name, Payload: payload}); err != nil {
					return written, err
				}
			}
		}
		messages = append(messages, llm.ChatMessage{Role: llm.RoleTool, Results: results})

		// The budget ran out mid-work: close the turn honestly instead of
		// letting the loop die with an unfinished tool answer.
		if step == maxSteps-1 {
			final := "I stopped here: this turn ran out of working steps. The tools have run as far as shown; ask me to continue and I will pick it up from the results."
			assistant := models.AgentMessage{
				ConversationID: s.Conversation.ID,
				Role:           models.AgentRoleAssistant,
				Content:        final,
			}
			if err := persist(&assistant); err != nil {
				return written, err
			}
			if err := emit(Event{Type: EventMessage, Text: final}); err != nil {
				return written, err
			}
			_ = emit(Event{Type: EventDone})
			logTurn(s, maxSteps, llm.Usage{}, nil)
			return written, nil
		}
	}
}

// persistAssistantCalls writes the model's tool-requesting turn: its text and
// the calls it asked for, all in one row's payload.
func persistAssistantCalls(conversationID uuid.UUID, result llm.ChatResult, persist func(*models.AgentMessage) error) error {
	calls := make([]map[string]any, 0, len(result.ToolCalls))
	for _, call := range result.ToolCalls {
		var args any
		_ = json.Unmarshal(call.Args, &args) // the model's own JSON; the tools validate it
		calls = append(calls, map[string]any{"id": call.ID, "name": call.Name, "args": args})
	}
	payload, err := json.Marshal(calls)
	if err != nil {
		return err
	}
	row := models.AgentMessage{
		ConversationID: conversationID,
		Role:           models.AgentRoleAssistant,
		Content:        result.Text,
		ToolPayload:    payload,
		TokensIn:       result.Usage.Input,
		TokensOut:      result.Usage.Output,
	}
	return persist(&row)
}

// chatHistory maps stored rows back onto the wire format, merging each
// assistant turn's calls with the tool rows that answered them.
func chatHistory(rows []models.AgentMessage) []llm.ChatMessage {
	messages := make([]llm.ChatMessage, 0, len(rows))
	for _, row := range rows {
		switch row.Role {
		case models.AgentRoleUser:
			messages = append(messages, llm.ChatMessage{Role: llm.RoleUser, Text: row.Content})
		case models.AgentRoleAssistant:
			m := llm.ChatMessage{Role: llm.RoleAssistant, Text: row.Content}
			if len(row.ToolPayload) > 0 {
				var calls []struct {
					ID   string          `json:"id"`
					Name string          `json:"name"`
					Args json.RawMessage `json:"args"`
				}
				if err := json.Unmarshal(row.ToolPayload, &calls); err == nil {
					for _, call := range calls {
						m.Calls = append(m.Calls, llm.ToolCall{ID: call.ID, Name: call.Name, Args: call.Args})
					}
				}
			}
			messages = append(messages, m)
		case models.AgentRoleTool:
			result := llm.ToolResult{Content: string(row.ToolPayload)}
			// Merge into the previous tool message when it answers the same
			// assistant turn, so the providers see one tool block per turn.
			if len(messages) > 0 && messages[len(messages)-1].Role == llm.RoleTool {
				messages[len(messages)-1].Results = append(messages[len(messages)-1].Results, result)
			} else {
				messages = append(messages, llm.ChatMessage{Role: llm.RoleTool, Results: []llm.ToolResult{result}})
			}
		}
	}
	return messages
}

// toolSummary shrinks a tool result into the one line the client shows while
// the turn continues.
func toolSummary(name, content string) string {
	if summary, ok := mcpSummary(name); ok {
		return summary
	}
	switch name {
	case toolSearch:
		return "searched the mailbox"
	case toolGet:
		return "read an email"
	case toolStats:
		return "collected mailbox statistics"
	case toolMove:
		return "moved an email"
	case toolFlags:
		return "updated an email's flags"
	case toolProposeReply:
		return "proposed a reply for approval"
	case toolProposeForward:
		return "proposed a forward for approval"
	case toolProposeEmail:
		return "proposed a new email for approval"
	}
	return strings.TrimSpace(content)
}

// logTurn notes a finished turn for the server log; the conversation rows are
// the real record.
func logTurn(s Session, steps int, usage llm.Usage, err error) {
	if err != nil {
		slog.Warn("agent turn failed", "conversation", s.Conversation.ID, "steps", steps, "error", err)
		return
	}
	slog.Debug("agent turn finished", "conversation", s.Conversation.ID, "steps", steps,
		"tokens_in", usage.Input, "tokens_out", usage.Output)
}
