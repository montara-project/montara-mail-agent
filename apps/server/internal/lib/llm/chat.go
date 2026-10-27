package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
)

// ChatClient adds multi-turn tool-calling chat to the one-shot Client the
// stateless tasks (summary, suggestions, classification) use. Both provider
// implementations carry both interfaces.
type ChatClient interface {
	Client
	// Chat runs one model turn over Messages, with Tools it may call. The
	// caller executes returned calls and continues the conversation with
	// tool-role messages.
	Chat(ctx context.Context, req ChatRequest) (ChatResult, error)
}

// Role of a chat message on the wire.
type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleTool      Role = "tool"
)

// ToolCall is the model's request to run one tool.
type ToolCall struct {
	ID   string
	Name string
	// Args carries the call's arguments as the JSON object the model produced.
	Args json.RawMessage
}

// ToolResult answers one ToolCall.
type ToolResult struct {
	CallID  string
	Content string
	// Error marks a failed execution, which both providers relay to the model.
	Error bool
}

// ToolDef declares a tool the model may call; Parameters is the JSON Schema
// of its object argument.
type ToolDef struct {
	Name        string
	Description string
	Parameters  json.RawMessage
}

// ChatMessage is one turn of a conversation: user or assistant text, an
// assistant turn that requests tool calls, or a tool turn answering them.
type ChatMessage struct {
	Role    Role
	Text    string
	Calls   []ToolCall   // RoleAssistant: calls the model asked for
	Results []ToolResult // RoleTool: answers to the previous assistant turn
}

// ChatRequest is one Chat call: the fixed system prompt, the conversation so
// far, and the tools.
type ChatRequest struct {
	System    string
	Messages  []ChatMessage
	Tools     []ToolDef
	MaxTokens int64
}

// Usage counts the tokens one Chat call spent.
type Usage struct {
	Input  int
	Output int
}

// ChatResult is one model turn: text, tool calls it wants run, or both.
type ChatResult struct {
	Text      string
	ToolCalls []ToolCall
	Usage     Usage
}

// WantsTools reports whether the turn asked for tool calls to run.
func (r ChatResult) WantsTools() bool { return len(r.ToolCalls) > 0 }

// chat converts the neutral conversation into the Anthropic wire format.
func (c anthropicClient) chatMessages(req ChatRequest) ([]anthropic.MessageParam, error) {
	messages := make([]anthropic.MessageParam, 0, len(req.Messages))
	for i, m := range req.Messages {
		switch m.Role {
		case RoleUser:
			messages = append(messages, anthropic.NewUserMessage(anthropic.NewTextBlock(m.Text)))
		case RoleAssistant:
			blocks := []anthropic.ContentBlockParamUnion{}
			if m.Text != "" {
				blocks = append(blocks, anthropic.NewTextBlock(m.Text))
			}
			for _, call := range m.Calls {
				var input any
				if err := json.Unmarshal(call.Args, &input); err != nil {
					return nil, fmt.Errorf("tool call %s: %w", call.Name, err)
				}
				blocks = append(blocks, anthropic.NewToolUseBlock(call.ID, input, call.Name))
			}
			messages = append(messages, anthropic.NewAssistantMessage(blocks...))
		case RoleTool:
			// Tool results travel in a user message, one block per call, in
			// the order the calls were made.
			if len(m.Results) == 0 {
				return nil, fmt.Errorf("message %d: tool role without results", i)
			}
			blocks := make([]anthropic.ContentBlockParamUnion, 0, len(m.Results))
			for _, r := range m.Results {
				blocks = append(blocks, anthropic.NewToolResultBlock(r.CallID, r.Content, r.Error))
			}
			messages = append(messages, anthropic.NewUserMessage(blocks...))
		default:
			return nil, fmt.Errorf("unknown message role %q", m.Role)
		}
	}
	return messages, nil
}

// chatTools converts the neutral tool declarations into the Anthropic format.
func chatTools(tools []ToolDef) ([]anthropic.ToolUnionParam, error) {
	params := make([]anthropic.ToolUnionParam, 0, len(tools))
	for _, def := range tools {
		var schema struct {
			Properties any      `json:"properties"`
			Required   []string `json:"required"`
		}
		if len(def.Parameters) > 0 {
			if err := json.Unmarshal(def.Parameters, &schema); err != nil {
				return nil, fmt.Errorf("tool %s: %w", def.Name, err)
			}
		}
		params = append(params, anthropic.ToolUnionParam{OfTool: &anthropic.ToolParam{
			Name:        def.Name,
			Description: anthropic.String(def.Description),
			InputSchema: anthropic.ToolInputSchemaParam{Properties: schema.Properties, Required: schema.Required},
		}})
	}
	return params, nil
}

// Chat runs one Anthropic turn, tools included.
func (c anthropicClient) Chat(ctx context.Context, req ChatRequest) (ChatResult, error) {
	messages, err := c.chatMessages(req)
	if err != nil {
		return ChatResult{}, err
	}
	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(c.model),
		MaxTokens: req.MaxTokens,
		System:    []anthropic.TextBlockParam{{Text: req.System}},
		Messages:  messages,
	}
	if tools, err := chatTools(req.Tools); err != nil {
		return ChatResult{}, err
	} else if len(tools) > 0 {
		params.Tools = tools
	}

	resp, err := c.client.Messages.New(ctx, params)
	if err != nil {
		return ChatResult{}, err
	}
	if resp.StopReason == anthropic.StopReasonRefusal {
		return ChatResult{}, ErrRefused
	}

	var out ChatResult
	for _, block := range resp.Content {
		switch b := block.AsAny().(type) {
		case anthropic.TextBlock:
			out.Text += b.Text
		case anthropic.ToolUseBlock:
			out.ToolCalls = append(out.ToolCalls, ToolCall{ID: b.ID, Name: b.Name, Args: b.Input})
		}
	}
	out.Text = strings.TrimSpace(out.Text)
	out.Usage = Usage{Input: int(resp.Usage.InputTokens), Output: int(resp.Usage.OutputTokens)}
	return out, nil
}

// openaiChatCall is the subset of the chat-completions answer the agent loop
// reads.
type openaiToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// chatBody builds the chat-completions request body, tools included.
func (c openAIClient) chatBody(req ChatRequest) (map[string]any, error) {
	messages := []map[string]any{{"role": "system", "content": req.System}}
	for i, m := range req.Messages {
		switch m.Role {
		case RoleUser:
			messages = append(messages, map[string]any{"role": "user", "content": m.Text})
		case RoleAssistant:
			entry := map[string]any{"role": "assistant", "content": m.Text}
			if len(m.Calls) > 0 {
				calls := make([]map[string]any, 0, len(m.Calls))
				for _, call := range m.Calls {
					args := string(call.Args)
					if args == "" {
						args = "{}"
					}
					calls = append(calls, map[string]any{
						"id": call.ID, "type": "function",
						"function": map[string]string{"name": call.Name, "arguments": args},
					})
				}
				entry["tool_calls"] = calls
			}
			messages = append(messages, entry)
		case RoleTool:
			if len(m.Results) == 0 {
				return nil, fmt.Errorf("message %d: tool role without results", i)
			}
			for _, r := range m.Results {
				messages = append(messages, map[string]any{
					"role": "tool", "tool_call_id": r.CallID, "content": r.Content,
				})
			}
		default:
			return nil, fmt.Errorf("unknown message role %q", m.Role)
		}
	}

	body := map[string]any{
		"model":      c.model,
		"max_tokens": req.MaxTokens,
		"messages":   messages,
	}
	if len(req.Tools) > 0 {
		tools := make([]map[string]any, 0, len(req.Tools))
		for _, def := range req.Tools {
			var schema any
			if len(def.Parameters) > 0 {
				if err := json.Unmarshal(def.Parameters, &schema); err != nil {
					return nil, fmt.Errorf("tool %s: %w", def.Name, err)
				}
			} else {
				schema = map[string]any{"type": "object", "properties": map[string]any{}}
			}
			tools = append(tools, map[string]any{
				"type": "function",
				"function": map[string]any{
					"name": def.Name, "description": def.Description, "parameters": schema,
				},
			})
		}
		body["tools"] = tools
	}
	return body, nil
}

// Chat runs one chat-completions turn, tools included.
func (c openAIClient) Chat(ctx context.Context, req ChatRequest) (ChatResult, error) {
	body, err := c.chatBody(req)
	if err != nil {
		return ChatResult{}, err
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return ChatResult{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(raw))
	if err != nil {
		return ChatResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return ChatResult{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return ChatResult{}, fmt.Errorf("chat completions: %s: %s", resp.Status, bytes.TrimSpace(snippet))
	}

	var out struct {
		Choices []struct {
			Message struct {
				Content   string           `json:"content"`
				ToolCalls []openaiToolCall `json:"tool_calls"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); err != nil {
		return ChatResult{}, fmt.Errorf("chat completions: %w", err)
	}
	if len(out.Choices) == 0 {
		return ChatResult{}, errors.New("chat completions: no choices in the answer")
	}
	if out.Choices[0].FinishReason == "content_filter" {
		return ChatResult{}, ErrRefused
	}

	result := ChatResult{Text: strings.TrimSpace(out.Choices[0].Message.Content)}
	for _, call := range out.Choices[0].Message.ToolCalls {
		result.ToolCalls = append(result.ToolCalls, ToolCall{
			ID:   call.ID,
			Name: call.Function.Name,
			Args: json.RawMessage(call.Function.Arguments),
		})
	}
	result.Usage = Usage{Input: out.Usage.PromptTokens, Output: out.Usage.CompletionTokens}
	return result, nil
}
