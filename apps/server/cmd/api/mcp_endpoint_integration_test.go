package main

import (
	"context"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/models"
)

// mcpRPC sends one JSON-RPC request to /mcp, as a streamable HTTP client does.
func mcpRPC(call callFunc, key, method string, params any) (int, map[string]any) {
	body := map[string]any{"jsonrpc": "2.0", "id": 1, "method": method}
	if params != nil {
		body["params"] = params
	}
	return call(http.MethodPost, "/mcp", key, body, "Accept", "application/json, text/event-stream")
}

// mcpTool calls one tool and returns its text and whether it is an error.
func mcpTool(t *testing.T, call callFunc, key, name string, args map[string]any) (string, bool) {
	t.Helper()
	status, out := mcpRPC(call, key, "tools/call", map[string]any{"name": name, "arguments": args})
	result, _ := out["result"].(map[string]any)
	if status != http.StatusOK || result == nil {
		t.Fatalf("tools/call %s: %d %v", name, status, out)
	}
	content := result["content"].([]any)
	isError, _ := result["isError"].(bool)
	return content[0].(map[string]any)["text"].(string), isError
}

// testMCPEndpoint walks /mcp: an API key reaches the user's mailboxes and
// nothing else, a proposal waits in the app for approval, and a revoked key
// stops working.
func testMCPEndpoint(t *testing.T, call callFunc, server *fiber.App, application *app.Application, userToken, userOrg, otherOrg string) {
	t.Helper()
	ctx := context.Background()

	status, out := call(http.MethodPost, "/api/v1/me/api-keys", userToken, map[string]any{"name": "Claude Desktop", "expires_in_days": 400})
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("a key for more than a year: %d %v, want 422", status, out)
	}
	status, out = call(http.MethodPost, "/api/v1/me/api-keys", userToken, map[string]any{"name": "Claude Desktop"})
	key, _ := data(out)["key"].(string)
	if status != http.StatusCreated || !strings.HasPrefix(key, apiKeyPrefix) {
		t.Fatalf("create key: %d %v", status, out)
	}
	keyID := data(out)["api_key"].(map[string]any)["id"].(string)
	if status, out := call(http.MethodGet, "/api/v1/me/api-keys", userToken, nil); status != http.StatusOK || len(list(out)) != 1 || list(out)[0].(map[string]any)["key"] != nil {
		t.Fatalf("list keys: %d %v", status, out)
	}

	// The key opens /mcp and nothing else: not the API, not Authula's routes
	// (where a token pair could be minted), whichever header carries it.
	if status, _ := call(http.MethodGet, "/api/v1/organizations", key, nil); status != http.StatusUnauthorized {
		t.Fatalf("key on the API: %d, want 401", status)
	}
	for _, headers := range [][]string{{"Authorization", "Bearer " + key}, {"X-AUTHULA-API-KEY", key}} {
		if status, _ := call(http.MethodGet, "/api/v1/auth/me", "", nil, headers...); status != http.StatusUnauthorized {
			t.Fatalf("key as %s on Authula: %d, want 401", headers[0], status)
		}
	}
	// And /mcp takes nothing but a key.
	if status, _ := mcpRPC(call, userToken, "tools/list", nil); status != http.StatusUnauthorized {
		t.Fatalf("access token on /mcp: %d, want 401", status)
	}
	if status, _ := mcpRPC(call, "", "tools/list", nil); status != http.StatusUnauthorized {
		t.Fatalf("no key on /mcp: %d, want 401", status)
	}

	mine := []models.Mail{{FromEmail: "vendor@example.com", FromName: "Vendor", Subject: "Quote 42", Body: "Here is the quote you asked for.", Folder: "inbox"}}
	account := seedAccount(t, application, userOrg, mine...)
	theirs := []models.Mail{{FromEmail: "secret@example.com", Subject: "Someone else's", Body: "Not yours.", Folder: "inbox"}}
	seedAccount(t, application, otherOrg, theirs...)

	status, out = mcpRPC(call, key, "tools/list", nil)
	if status != http.StatusOK {
		t.Fatalf("tools/list: %d %v", status, out)
	}
	tools := map[string]map[string]any{}
	for _, raw := range out["result"].(map[string]any)["tools"].([]any) {
		tool := raw.(map[string]any)
		tools[tool["name"].(string)] = tool
	}
	for _, name := range []string{"list_accounts", "search_mails", "get_mail", "propose_reply"} {
		if tools[name] == nil {
			t.Fatalf("tools/list misses %s: %v", name, out)
		}
	}
	if props := tools["search_mails"]["inputSchema"].(map[string]any)["properties"].(map[string]any); props["account_id"] == nil {
		t.Fatalf("search_mails takes no account_id: %v", tools["search_mails"])
	}

	if text, isError := mcpTool(t, call, key, "list_accounts", nil); isError || !strings.Contains(text, account.ID.String()) || strings.Contains(text, "secret@example.com") {
		t.Fatalf("list_accounts: %v %s", isError, text)
	}
	if text, isError := mcpTool(t, call, key, "search_mails", map[string]any{"account_id": account.ID}); isError || !strings.Contains(text, "Quote 42") {
		t.Fatalf("search_mails: %v %s", isError, text)
	}
	if text, isError := mcpTool(t, call, key, "get_mail", map[string]any{"mail_id": mine[0].ID}); isError || !strings.Contains(text, "Here is the quote") {
		t.Fatalf("get_mail: %v %s", isError, text)
	}
	// Another organization's mail and mailbox read as missing.
	if text, isError := mcpTool(t, call, key, "get_mail", map[string]any{"mail_id": theirs[0].ID}); !isError || strings.Contains(text, "Not yours") {
		t.Fatalf("get_mail of another organization: %v %s", isError, text)
	}
	if _, isError := mcpTool(t, call, key, "search_mails", map[string]any{"account_id": uuid.NewString()}); !isError {
		t.Fatal("search_mails of an unknown account succeeded")
	}

	// A proposal is queued in the mailbox's "Connected apps" conversation,
	// twice in the same one; nothing is sent.
	for range 2 {
		if text, isError := mcpTool(t, call, key, "propose_reply", map[string]any{"mail_id": mine[0].ID, "text": "Thanks, looks good."}); isError || !strings.Contains(text, "waiting for the user's approval") {
			t.Fatalf("propose_reply: %v %s", isError, text)
		}
	}
	var convID uuid.UUID
	var convs int
	err := application.DB.QueryRowContext(ctx, `
		SELECT min(id::text)::uuid, count(*) FROM agent_conversations
		WHERE email_account_id = $1 AND title = 'Connected apps'`, account.ID).Scan(&convID, &convs)
	if err != nil || convs != 1 {
		t.Fatalf("the Connected apps conversation: %d of them, %v", convs, err)
	}
	actions, err := application.Repositories.Agent.ActionsOf(ctx, convID, 10)
	if err != nil || len(actions) != 2 || actions[0].Status != models.AgentActionPending {
		t.Fatalf("proposals: %v %v", err, actions)
	}

	testMCPClient(t, server, key)

	// Nothing holds a request open: the tool list never changes, so a
	// subscription to it is not offered.
	started := time.Now()
	status, out = call(http.MethodPost, "/mcp", key,
		map[string]any{"jsonrpc": "2.0", "id": 9, "method": "subscriptions/listen", "params": map[string]any{"notifications": map[string]any{"toolsListChanged": true}}},
		"Accept", "application/json, text/event-stream", "Mcp-Protocol-Version", "2025-06-18")
	if time.Since(started) > 5*time.Second {
		t.Fatalf("subscriptions/listen held the request for %s: %d %v", time.Since(started), status, out)
	}
	// A batch would run many tool calls under one request of the rate limit.
	batch := []byte(`[{"jsonrpc":"2.0","id":1,"method":"tools/list"},{"jsonrpc":"2.0","id":2,"method":"tools/list"}]`)
	if status, _ := call(http.MethodPost, "/mcp", key, batch, "Accept", "application/json, text/event-stream"); status != http.StatusBadRequest {
		t.Fatalf("JSON-RPC batch: %d, want 400", status)
	}

	// Revoking the key closes /mcp to it.
	if status, out := call(http.MethodDelete, "/api/v1/me/api-keys/"+keyID, userToken, nil); status != http.StatusOK {
		t.Fatalf("revoke: %d %v", status, out)
	}
	if status, _ := mcpRPC(call, key, "tools/list", nil); status != http.StatusUnauthorized {
		t.Fatalf("revoked key on /mcp: %d, want 401", status)
	}
	if status, _ := call(http.MethodDelete, "/api/v1/me/api-keys/"+keyID, userToken, nil); status != http.StatusNotFound {
		t.Fatalf("revoke twice: %d, want 404", status)
	}
}

// bearer signs every request of an HTTP client with one key.
type bearer struct{ key string }

func (b bearer) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("Authorization", "Bearer "+b.key)
	return http.DefaultTransport.RoundTrip(r)
}

// testMCPClient connects the SDK's own client over a real socket, the way an
// MCP host does: initialize, the standalone event stream a stateless server
// declines, then the tools.
func testMCPClient(t *testing.T, server *fiber.App, key string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	go func() { _ = server.Listener(ln, fiber.ListenConfig{DisableStartupMessage: true}) }()

	ctx := context.Background()
	client := mcp.NewClient(&mcp.Implementation{Name: "test-host", Version: "1.0.0"}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint:   "http://" + ln.Addr().String() + "/mcp",
		HTTPClient: &http.Client{Transport: bearer{key}},
	}, nil)
	if err != nil {
		t.Fatalf("MCP client connect: %v", err)
	}
	defer session.Close()

	if got := session.InitializeResult().ServerInfo.Name; got != "montara-mail" {
		t.Fatalf("server name %q", got)
	}
	tools, err := session.ListTools(ctx, nil)
	if err != nil || len(tools.Tools) == 0 {
		t.Fatalf("MCP client tools/list: %v %v", err, tools)
	}
	res, err := session.CallTool(ctx, &mcp.CallToolParams{Name: "list_accounts"})
	if err != nil || res.IsError {
		t.Fatalf("MCP client list_accounts: %v %v", err, res)
	}
}
