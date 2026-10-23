package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type callFunc func(method, path, token string, body any, headers ...string) (int, map[string]any)

// fakeLLM answers every prompt without a network call.
type fakeLLM struct{ calls int }

func (f *fakeLLM) Complete(_ context.Context, system, _ string, _ int64) (string, error) {
	f.calls++
	if strings.Contains(system, "reply options") {
		return "Sure, sounds good.\nCan we talk on Monday?\nNo, thanks.", nil
	}
	return "**TL;DR** a fake summary", nil
}

// seedAccount stores an account and its mail the way a sync leaves them; the
// tests have no IMAP server.
func seedAccount(t *testing.T, application *app.Application, organizationID string, mails ...models.Mail) models.EmailAccount {
	t.Helper()
	ctx := context.Background()
	account := models.EmailAccount{
		OrganizationID: uuid.MustParse(organizationID),
		Provider:       constant.ProviderGmail,
		Label:          "Work",
		Email:          uuid.NewString()[:8] + "@example.com",
		// Loopback, which the guarded dialer refuses: write-backs the tests
		// trigger fail fast instead of reaching a real server.
		IMAPHost: "127.0.0.1",
		IMAPPort: 9,
		SMTPHost: "127.0.0.1",
		SMTPPort: 9,
		Password: application.Secrets.Seal("app-password"),
	}
	account.ID = uuid.Must(uuid.NewV7())
	account.Username = account.Email
	if err := application.Repositories.EmailAccount.Insert(ctx, account); err != nil {
		t.Fatal(err)
	}
	for i := range mails {
		mails[i].ID = uuid.Must(uuid.NewV7())
		mails[i].EmailAccountID = account.ID
		mails[i].UIDValidity = 1
		mails[i].UID = uint32(i + 1)
		mails[i].To, mails[i].Cc = []models.MailContact{}, []models.MailContact{}
		if mails[i].ReceivedAt.IsZero() {
			mails[i].ReceivedAt = time.Now().Add(-time.Duration(i) * time.Hour)
		}
	}
	if err := application.Repositories.Mail.InsertMany(ctx, mails); err != nil {
		t.Fatal(err)
	}
	return account
}

func data(out map[string]any) map[string]any {
	d, _ := out["data"].(map[string]any)
	return d
}

func list(out map[string]any) []any {
	l, _ := out["data"].([]any)
	return l
}

// testMailFlow covers email accounts, mail, AI and the LLM provider for a
// user who owns userOrg and is no member of otherOrg.
func testMailFlow(t *testing.T, call callFunc, application *app.Application, token, userOrg, otherOrg string) {
	org := "/api/v1/organizations/" + userOrg

	if status, out := call(http.MethodGet, org+"/stats", token, nil); status != http.StatusOK || data(out)["accounts"] != float64(0) {
		t.Fatalf("empty stats: %d %v", status, out)
	}

	// Connecting validates the provider, needs a host for custom IMAP, and
	// refuses hosts on the server's own network.
	if status, _ := call(http.MethodPost, org+"/email-accounts", token, map[string]any{"provider": "hotmail", "email": "a@example.com", "password": "x"}); status != http.StatusUnprocessableEntity {
		t.Fatalf("unknown provider: %d, want 422", status)
	}
	if status, _ := call(http.MethodPost, org+"/email-accounts", token, map[string]any{"provider": "imap", "email": "a@example.com", "password": "x"}); status != http.StatusBadRequest {
		t.Fatalf("custom IMAP without host: %d, want 400", status)
	}
	status, out := call(http.MethodPost, org+"/email-accounts", token, map[string]any{"provider": "imap", "email": "a@example.com", "password": "x", "imap_host": "127.0.0.1", "imap_port": 993})
	if status != http.StatusBadRequest || !strings.Contains(out["message"].(string), "not allowed") {
		t.Fatalf("loopback IMAP host: %d %v, want 400 not allowed", status, out)
	}

	account := seedAccount(t, application, userOrg,
		models.Mail{Folder: constant.FolderInbox, FromName: "Boss", FromEmail: "boss@example.com", Subject: "Contract due Friday", Body: "Please sign\n\nthe contract."},
		models.Mail{Folder: constant.FolderInbox, FromEmail: "news@shop.example", Subject: "Sale", Body: "50% off"},
		models.Mail{Folder: constant.FolderInbox, FromEmail: "old@example.com", Subject: "Old", Body: "read already", IsRead: true},
		models.Mail{Folder: constant.FolderSpam, FromEmail: "spam@example.com", Subject: "You won", Body: "click"},
	)
	accountPath := "/api/v1/email-accounts/" + account.ID.String()

	status, out = call(http.MethodGet, org+"/stats", token, nil)
	if d := data(out); status != http.StatusOK || d["unread"] != float64(2) || d["spam"] != float64(1) || d["accounts"] != float64(1) {
		t.Fatalf("stats: %d %v", status, out)
	}
	status, out = call(http.MethodGet, org+"/email-accounts", token, nil)
	if status != http.StatusOK || len(list(out)) != 1 {
		t.Fatalf("accounts: %d %v", status, out)
	}
	if a := list(out)[0].(map[string]any); a["unread"] != float64(2) || a["spam"] != float64(1) || a["password"] != nil {
		t.Fatalf("account row: %v", a)
	}

	status, out = call(http.MethodGet, accountPath+"/mails", token, nil)
	if status != http.StatusOK || len(list(out)) != 3 || out["metadata"].(map[string]any)["unread"] != float64(2) {
		t.Fatalf("inbox: %d %v", status, out)
	}
	first := list(out)[0].(map[string]any)
	if first["subject"] != "Contract due Friday" || first["teaser"] != "Please sign the contract." || first["body"] != nil {
		t.Fatalf("newest inbox mail: %v", first)
	}
	mailPath := "/api/v1/mails/" + first["id"].(string)
	if status, out := call(http.MethodGet, accountPath+"/mails?folder=spam", token, nil); status != http.StatusOK || len(list(out)) != 1 {
		t.Fatalf("spam: %d %v", status, out)
	}
	if status, out := call(http.MethodGet, accountPath+"/mails?search=sale", token, nil); status != http.StatusOK || len(list(out)) != 1 {
		t.Fatalf("search: %d %v", status, out)
	}
	if status, _ := call(http.MethodGet, accountPath+"/mails?folder=junk", token, nil); status != http.StatusUnprocessableEntity {
		t.Fatalf("unknown folder: %d, want 422", status)
	}

	if status, out := call(http.MethodGet, mailPath, token, nil); status != http.StatusOK || data(out)["body"] != "Please sign\n\nthe contract." {
		t.Fatalf("read mail: %d %v", status, out)
	}
	if status, out := call(http.MethodPatch, mailPath, token, map[string]any{"is_read": true, "importance": "important"}); status != http.StatusOK || data(out)["is_read"] != true || data(out)["importance_by"] != "user" {
		t.Fatalf("patch: %d %v", status, out)
	}
	if status, out := call(http.MethodGet, accountPath+"/mails", token, nil); status != http.StatusOK || out["metadata"].(map[string]any)["unread"] != float64(1) {
		t.Fatalf("unread after reading one: %d %v", status, out)
	}
	if status, out := call(http.MethodGet, accountPath+"/mails?importance=important", token, nil); status != http.StatusOK || len(list(out)) != 1 {
		t.Fatalf("by importance: %d %v", status, out)
	}
	// The AI never overwrites the user's choice.
	if err := application.Repositories.Mail.SetAIImportance(context.Background(), uuid.MustParse(first["id"].(string)), constant.ImportanceLowPriority); err != nil {
		t.Fatal(err)
	}
	if _, out := call(http.MethodGet, mailPath, token, nil); data(out)["importance"] != "important" {
		t.Fatalf("AI overwrote the user's importance: %v", out)
	}

	// AI: 503 with no provider and no fallback, then answered by the fallback.
	if status, _ := call(http.MethodPost, mailPath+"/summary", token, nil); status != http.StatusServiceUnavailable {
		t.Fatalf("summary without AI: %d, want 503", status)
	}
	fake := &fakeLLM{}
	application.AI = fake
	defer func() { application.AI = nil }()
	for range 2 {
		if status, out := call(http.MethodPost, mailPath+"/summary", token, nil); status != http.StatusOK || data(out)["summary"] != "**TL;DR** a fake summary" {
			t.Fatalf("summary: %d %v", status, out)
		}
	}
	if fake.calls != 1 {
		t.Fatalf("summary called the model %d times, want once then cached", fake.calls)
	}
	// The kept summary comes with the mail, and stays out of lists.
	if _, out := call(http.MethodGet, mailPath, token, nil); data(out)["summary"] != "**TL;DR** a fake summary" {
		t.Fatalf("mail without its summary: %v", out)
	}
	if _, out := call(http.MethodGet, accountPath+"/mails", token, nil); list(out)[0].(map[string]any)["summary"] != nil {
		t.Fatalf("list carries the summary: %v", list(out)[0])
	}
	if status, out := call(http.MethodPost, mailPath+"/reply-suggestions", token, nil); status != http.StatusOK || len(data(out)["suggestions"].([]any)) != 3 {
		t.Fatalf("reply suggestions: %d %v", status, out)
	}

	// Moving and forwarding validate first, then answer for the mail server.
	if status, _ := call(http.MethodPost, mailPath+"/move", token, map[string]any{"folder": "sent"}); status != http.StatusUnprocessableEntity {
		t.Fatalf("move to sent: %d, want 422", status)
	}
	if status, _ := call(http.MethodPost, mailPath+"/move", token, map[string]any{"folder": "inbox"}); status != http.StatusBadRequest {
		t.Fatalf("move to its own folder: %d, want 400", status)
	}
	if status, out := call(http.MethodPost, mailPath+"/move", token, map[string]any{"folder": "spam"}); status != http.StatusBadGateway {
		t.Fatalf("move with the server unreachable: %d %v, want 502", status, out)
	}
	if status, _ := call(http.MethodPost, mailPath+"/forward", token, map[string]any{"to": []string{"not an address"}}); status != http.StatusUnprocessableEntity {
		t.Fatalf("forward to a bad address: %d, want 422", status)
	}
	if status, _ := call(http.MethodPost, mailPath+"/forward", token, map[string]any{"to": []string{}}); status != http.StatusUnprocessableEntity {
		t.Fatalf("forward to nobody: %d, want 422", status)
	}
	if status, _ := call(http.MethodPost, mailPath+"/reply", token, map[string]any{"html": "<p>no text</p>"}); status != http.StatusUnprocessableEntity {
		t.Fatalf("reply without text: %d, want 422", status)
	}
	if status, out := call(http.MethodPost, mailPath+"/reply", token, map[string]any{"text": "Thanks"}); status != http.StatusBadGateway {
		t.Fatalf("reply with the server unreachable: %d %v, want 502", status, out)
	}

	// A new mail checks its recipients before reaching for the server.
	send := accountPath + "/send"
	if status, _ := call(http.MethodPost, send, token, map[string]any{"subject": "Hi", "text": "Hello"}); status != http.StatusUnprocessableEntity {
		t.Fatalf("send without recipients: %d, want 422", status)
	}
	many := make([]string, 21)
	for i := range many {
		many[i] = fmt.Sprintf("r%d@example.com", i)
	}
	if status, _ := call(http.MethodPost, send, token, map[string]any{"to": many[:11], "cc": many[11:], "text": "Hello"}); status != http.StatusBadRequest {
		t.Fatalf("send to 21 addresses: %d, want 400", status)
	}
	if status, out := call(http.MethodPost, send, token, map[string]any{"to": []string{"a@example.com"}, "text": "Hello"}); status != http.StatusBadGateway {
		t.Fatalf("send with the server unreachable: %d %v, want 502", status, out)
	}

	// Another organization's account and mail look missing.
	other := seedAccount(t, application, otherOrg, models.Mail{Folder: constant.FolderInbox, Subject: "Private"})
	otherMails, err := application.Repositories.Mail.List(context.Background(), other.ID, mailListAll())
	if err != nil || len(otherMails) != 1 {
		t.Fatalf("other mail: %v %v", otherMails, err)
	}
	for _, req := range []struct{ method, path string }{
		{http.MethodGet, "/api/v1/email-accounts/" + other.ID.String() + "/mails"},
		{http.MethodDelete, "/api/v1/email-accounts/" + other.ID.String()},
		{http.MethodPost, "/api/v1/email-accounts/" + other.ID.String() + "/send"},
		{http.MethodGet, "/api/v1/mails/" + otherMails[0].ID.String()},
		{http.MethodPost, "/api/v1/mails/" + otherMails[0].ID.String() + "/summary"},
		{http.MethodDelete, "/api/v1/mails/" + otherMails[0].ID.String()},
		{http.MethodPost, "/api/v1/mails/" + otherMails[0].ID.String() + "/forward"},
		{http.MethodPost, "/api/v1/mails/" + otherMails[0].ID.String() + "/reply"},
	} {
		if status, _ := call(req.method, req.path, token, nil); status != http.StatusNotFound {
			t.Fatalf("%s %s by a non-member: %d, want 404", req.method, req.path, status)
		}
	}

	// LLM provider: absent, then set, kept without resending the key, removed.
	llmPath := org + "/llm-provider"
	if status, out := call(http.MethodGet, llmPath, token, nil); status != http.StatusOK || out["data"] != nil || out["metadata"].(map[string]any)["fallback"] != true {
		t.Fatalf("no provider: %d %v", status, out)
	}
	if status, _ := call(http.MethodPut, llmPath, token, map[string]any{"kind": "openai", "model": "gpt-test"}); status != http.StatusBadRequest {
		t.Fatalf("first save without a key: %d, want 400", status)
	}
	if status, _ := call(http.MethodPut, llmPath, token, map[string]any{"kind": "openai", "model": "gpt-test", "api_key": "sk-x", "base_url": "http://example.com/v1"}); status != http.StatusBadRequest {
		t.Fatalf("http base URL: %d, want 400", status)
	}
	if status, out := call(http.MethodPut, llmPath, token, map[string]any{"kind": "openai", "model": "gpt-test", "api_key": "sk-x", "base_url": "https://llm.example.com/v1"}); status != http.StatusOK || data(out)["has_api_key"] != true || data(out)["api_key"] != nil {
		t.Fatalf("save provider: %d %v", status, out)
	}
	if status, out := call(http.MethodPut, llmPath, token, map[string]any{"kind": "anthropic", "model": "claude-test"}); status != http.StatusOK || data(out)["kind"] != "anthropic" {
		t.Fatalf("update keeping the key: %d %v", status, out)
	}
	if status, out := call(http.MethodDelete, llmPath, token, nil); status != http.StatusOK {
		t.Fatalf("remove provider: %d %v", status, out)
	}

	// An organization with an account can't be wiped; disconnecting drops the mail.
	if status, _ := call(http.MethodDelete, org+"/force", token, nil); status != http.StatusConflict {
		t.Fatalf("force delete with an account: %d, want 409", status)
	}
	if status, out := call(http.MethodDelete, accountPath, token, nil); status != http.StatusOK {
		t.Fatalf("disconnect: %d %v", status, out)
	}
	if status, out := call(http.MethodGet, mailPath, token, nil); status != http.StatusNotFound {
		t.Fatalf("mail after disconnect: %d %v, want 404", status, out)
	}
}

func mailListAll() repositories.MailListParams {
	return repositories.MailListParams{ListParams: repositories.ListParams{Limit: 100}, Folder: constant.FolderInbox}
}
