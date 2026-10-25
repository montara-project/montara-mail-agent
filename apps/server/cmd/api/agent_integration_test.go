package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/models"
)

// scriptedAgent plays a three-step copilot turn: search the inbox, propose a
// reply, then answer in text. The script repeats, so a second turn proposes
// again and the approval paths get exercised too.
type scriptedAgent struct {
	mailID string
	step   atomic.Int64
}

func (s *scriptedAgent) Complete(context.Context, string, string, int64) (string, error) {
	return "", llm.ErrRefused
}

func (s *scriptedAgent) Chat(_ context.Context, req llm.ChatRequest) (llm.ChatResult, error) {
	switch s.step.Add(1) % 3 {
	case 1:
		if len(req.Tools) == 0 {
			return llm.ChatResult{}, fmt.Errorf("scriptedAgent: expected tools")
		}
		return llm.ChatResult{ToolCalls: []llm.ToolCall{{
			ID:   "call-search",
			Name: "search_mails",
			Args: []byte(`{"folder": "inbox"}`),
		}}, Usage: llm.Usage{Input: 10, Output: 5}}, nil
	case 2:
		return llm.ChatResult{ToolCalls: []llm.ToolCall{{
			ID:   "call-propose",
			Name: "propose_reply",
			Args: []byte(fmt.Sprintf(`{"mail_id": %q, "text": "Thanks, the invoice is on its way."}`, s.mailID)),
		}}, Usage: llm.Usage{Input: 20, Output: 8}}, nil
	}
	return llm.ChatResult{
		Text:  "I found the invoice and proposed a reply; it waits for your approval.",
		Usage: llm.Usage{Input: 30, Output: 12},
	}, nil
}

// sseEvent is one server-sent event of a streamed answer.
type sseEvent struct {
	Type string
	Data string
}

func parseSSE(body string) []sseEvent {
	events := []sseEvent{}
	for _, block := range strings.Split(body, "\n\n") {
		name, data := "", ""
		for _, line := range strings.Split(block, "\n") {
			if rest, ok := strings.CutPrefix(line, "event: "); ok {
				name = rest
			}
			if rest, ok := strings.CutPrefix(line, "data: "); ok {
				data = rest
			}
		}
		if name != "" {
			events = append(events, sseEvent{Type: name, Data: data})
		}
	}
	return events
}

// testAgentFlow walks the copilot: a streamed turn that searches and proposes,
// the persisted conversation behind it, and the approval decision paths.
func testAgentFlow(t *testing.T, call callFunc, callStream func(method, path, token string, body any) (int, string), application *app.Application, userToken, orgID string) {
	t.Helper()

	// The mail flow leaves an LLM provider configured on this organization;
	// the agent test needs its scripted fallback to answer instead.
	call(http.MethodDelete, "/api/v1/organizations/"+orgID+"/llm-provider", userToken, nil)

	fake := &scriptedAgent{}
	application.AI = fake
	defer func() { application.AI = nil }()

	// A mailbox with one mail to answer; seedAccount stamps the ids in place.
	mails := []models.Mail{{
		FromEmail: "client@example.com",
		FromName:  "The Client",
		Subject:   "Invoice 7",
		Body:      "Please find the invoice attached. Could you confirm the payment date?",
		Folder:    "inbox",
	}}
	account := seedAccount(t, application, orgID, mails...)
	fake.mailID = mails[0].ID.String()

	// The streamed turn: search, propose, answer.
	status, body := callStream(http.MethodPost, "/api/v1/agent/chat", userToken, map[string]any{
		"email_account_id": account.ID,
		"message":          "Please answer the invoice email",
	})
	if status != http.StatusOK {
		t.Fatalf("agent chat: %d %s", status, body)
	}
	events := parseSSE(body)
	saw := map[string]bool{}
	var actionID string
	for _, ev := range events {
		saw[ev.Type] = true
		if ev.Type == "action" {
			var envelope struct {
				Payload json.RawMessage `json:"payload"`
			}
			if err := json.Unmarshal([]byte(ev.Data), &envelope); err != nil {
				t.Fatalf("action event: %v (%s)", err, ev.Data)
			}
			var payload struct {
				ID     string `json:"id"`
				Status string `json:"status"`
				Kind   string `json:"kind"`
			}
			if err := json.Unmarshal(envelope.Payload, &payload); err != nil {
				t.Fatalf("action payload: %v (%s)", err, envelope.Payload)
			}
			if payload.Status != "pending" || payload.Kind != "send_reply" {
				t.Fatalf("action event: %s %s", payload.Status, payload.Kind)
			}
			actionID = payload.ID
		}
	}
	for _, want := range []string{"tool", "message", "action", "done"} {
		if !saw[want] {
			t.Fatalf("agent chat stream misses a %q event: %v", want, events)
		}
	}
	if actionID == "" {
		t.Fatal("agent chat stream carried no proposed action")
	}

	// The conversation persists behind the stream.
	status, out := call(http.MethodGet, "/api/v1/agent/conversations?organization_id="+orgID, userToken, nil)
	rows := list(out)
	if status != http.StatusOK || len(rows) != 1 {
		t.Fatalf("agent conversations: %d %v", status, out)
	}
	conversation := rows[0].(map[string]any)["id"].(string)

	status, out = call(http.MethodGet, "/api/v1/agent/conversations/"+conversation, userToken, nil)
	if status != http.StatusOK {
		t.Fatalf("agent conversation: %d %v", status, out)
	}
	roles := []string{}
	for _, m := range data(out)["messages"].([]any) {
		roles = append(roles, m.(map[string]any)["role"].(string))
	}
	for _, want := range []string{"user", "assistant", "tool"} {
		if !slicesContains(roles, want) {
			t.Fatalf("conversation rows miss a %q message: %v", want, roles)
		}
	}

	// The proposal waits in the pending state; approving it against the
	// seeded account's refused SMTP host fails the action loudly.
	if status, out = call(http.MethodPost, "/api/v1/agent/actions/"+actionID+"/approve", userToken, nil); status != http.StatusBadGateway {
		t.Fatalf("approve against a refused SMTP host: %d %v, want 502", status, out)
	}
	status, out = call(http.MethodGet, "/api/v1/agent/conversations/"+conversation, userToken, nil)
	if status != http.StatusOK {
		t.Fatalf("conversation after approve: %d", status)
	}
	failedStatus := ""
	for _, a := range data(out)["actions"].([]any) {
		action := a.(map[string]any)
		if action["id"] == actionID {
			failedStatus = action["status"].(string)
		}
	}
	if failedStatus != "failed" {
		t.Fatalf("approved action status: %q, want failed", failedStatus)
	}

	// A denied proposal just ends denied.
	status, body = callStream(http.MethodPost, "/api/v1/agent/chat", userToken, map[string]any{
		"conversation_id": conversation,
		"message":         "Propose it again please",
	})
	if status != http.StatusOK {
		t.Fatalf("second agent chat: %d %s", status, body)
	}
	secondAction := ""
	for _, ev := range parseSSE(body) {
		if ev.Type == "action" {
			var envelope struct {
				Payload json.RawMessage `json:"payload"`
			}
			_ = json.Unmarshal([]byte(ev.Data), &envelope)
			var payload struct {
				ID string `json:"id"`
			}
			_ = json.Unmarshal(envelope.Payload, &payload)
			secondAction = payload.ID
		}
	}
	if status, out = call(http.MethodPost, "/api/v1/agent/actions/"+secondAction+"/deny", userToken, nil); status != http.StatusOK {
		t.Fatalf("deny: %d %v", status, out)
	}
	denied := data(out)
	if denied == nil {
		t.Fatalf("deny answered no data: %v", out)
	}
	if got := denied["status"]; got != "denied" {
		t.Fatalf("denied action status: %v", got)
	}

	// The drafts queue answers, empty in this flow.
	status, out = call(http.MethodGet, "/api/v1/agent/drafts?organization_id="+orgID, userToken, nil)
	if status != http.StatusOK || len(list(out)) != 0 {
		t.Fatalf("agent drafts: %d %v", status, out)
	}
}

func slicesContains(list []string, want string) bool {
	for _, item := range list {
		if item == want {
			return true
		}
	}
	return false
}
