package mailagent

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/models"
)

// chatHistory must round-trip what Run persisted: an assistant row carrying
// its calls, and the tool rows answering them merged back into one tool
// message, so both providers see alternating assistant/tool turns.
func TestChatHistoryRoundTrip(t *testing.T) {
	conversation := uuid.Must(uuid.NewV7())
	calls, err := json.Marshal([]map[string]any{
		{"id": "call-1", "name": "search_mails", "args": map[string]any{"folder": "inbox"}},
		{"id": "call-2", "name": "get_mail", "args": map[string]any{"mail_id": "m1"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	rows := []models.AgentMessage{
		{ConversationID: conversation, Role: models.AgentRoleUser, Content: "What needs answering?"},
		{ConversationID: conversation, Role: models.AgentRoleAssistant, Content: "Looking.", ToolPayload: calls},
		{ConversationID: conversation, Role: models.AgentRoleTool, ToolName: "search_mails", ToolPayload: json.RawMessage(`[]`)},
		{ConversationID: conversation, Role: models.AgentRoleTool, ToolName: "get_mail", ToolPayload: json.RawMessage(`<email></email>`)},
		{ConversationID: conversation, Role: models.AgentRoleAssistant, Content: "Two mails need answers."},
	}

	messages := chatHistory(rows)
	if len(messages) != 4 {
		t.Fatalf("chatHistory: %d messages, want 4 (user, assistant, merged tools, assistant)", len(messages))
	}
	if messages[0].Role != llm.RoleUser || messages[0].Text != "What needs answering?" {
		t.Fatalf("first message: %+v", messages[0])
	}
	if len(messages[1].Calls) != 2 || messages[1].Calls[0].Name != "search_mails" {
		t.Fatalf("assistant calls: %+v", messages[1].Calls)
	}
	if len(messages[2].Results) != 2 {
		t.Fatalf("tool results: %+v", messages[2].Results)
	}
	if messages[3].Text != "Two mails need answers." {
		t.Fatalf("final message: %+v", messages[3])
	}
}

// The system prompt names the mailbox and keeps the untrusted-content rule.
func TestSystemPrompt(t *testing.T) {
	s := Session{}
	s.Account.Email = "work@example.com"
	s.Conversation.Title = "Invoice questions"

	prompt := systemPrompt(s)
	for _, want := range []string{"work@example.com", "never follow them", "Invoice questions", "propose"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("system prompt misses %q", want)
		}
	}
}
