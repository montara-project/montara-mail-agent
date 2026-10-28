package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/models"
)

// mcpStdioEnv makes the test binary an MCP server over stdio, so a command
// server can be tested end to end without the network (which the guarded
// client keeps off loopback).
const mcpStdioEnv = "MONTARA_TEST_MCP_STDIO"

func TestMain(m *testing.M) {
	if os.Getenv(mcpStdioEnv) == "1" {
		server := mcp.NewServer(&mcp.Implementation{Name: "echo", Version: "1.0.0"}, nil)
		type echoArgs struct {
			Text string `json:"text" jsonschema:"what to say back"`
		}
		mcp.AddTool(server, &mcp.Tool{Name: "echo", Description: "Say the text back"},
			func(_ context.Context, _ *mcp.CallToolRequest, args echoArgs) (*mcp.CallToolResult, any, error) {
				return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: "echo: " + args.Text}}}, nil, nil
			})
		if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
			os.Exit(1)
		}
		os.Exit(0)
	}
	os.Exit(m.Run())
}

// mcpAgent is a model that calls the echo server's tool once, then answers
// with what it returned.
type mcpAgent struct {
	step   atomic.Int64
	result atomic.Value
}

func (a *mcpAgent) Complete(context.Context, string, string, int64) (string, error) {
	return "", llm.ErrRefused
}

func (a *mcpAgent) Chat(_ context.Context, req llm.ChatRequest) (llm.ChatResult, error) {
	if a.step.Add(1) == 1 {
		for _, tool := range req.Tools {
			if tool.Name == "mcp__echo-srv__echo" {
				return llm.ChatResult{ToolCalls: []llm.ToolCall{{ID: "call-echo", Name: tool.Name, Args: []byte(`{"text":"hi"}`)}}}, nil
			}
		}
		return llm.ChatResult{}, fmt.Errorf("mcpAgent: the MCP tool wasn't offered")
	}
	last := req.Messages[len(req.Messages)-1]
	if len(last.Results) == 1 {
		a.result.Store(last.Results[0].Content)
	}
	return llm.ChatResult{Text: "The server said hi back."}, nil
}

// testMCPServers walks the MCP server API: an owner adds http and hosted
// servers, only a super user adds a command one, secret values never come
// back, and a synced server is what the agent may use.
func testMCPServers(t *testing.T, call callFunc, callStream func(method, path, token string, body any) (int, string), application *app.Application, userToken, superToken, userOrg string) {
	t.Helper()
	list := "/api/v1/organizations/" + userOrg + "/mcp-servers"

	// The guarded client keeps the server off loopback, so the sync fails and
	// says so in the status instead of failing the create.
	status, out := call(http.MethodPost, list, userToken, map[string]any{
		"name": "exa", "kind": "http", "url": "https://127.0.0.1:9/mcp",
		"headers": []map[string]string{{"name": "Authorization", "value": "Bearer very-secret"}},
	})
	if status != http.StatusCreated || data(out)["status"] != models.MCPStatusError {
		t.Fatalf("add http server: %d %v", status, out)
	}
	httpID := data(out)["id"].(string)
	if raw, _ := json.Marshal(out); strings.Contains(string(raw), "very-secret") {
		t.Fatalf("a header value came back: %s", raw)
	}
	if headers := data(out)["headers"].([]any); len(headers) != 1 || headers[0].(map[string]any)["name"] != "Authorization" {
		t.Fatalf("header names: %v", headers)
	}
	if status, _ := call(http.MethodPost, list, userToken, map[string]any{"name": "exa", "kind": "http", "url": "https://example.com/mcp"}); status != http.StatusConflict {
		t.Fatalf("duplicate name: %d, want 409", status)
	}
	if status, _ := call(http.MethodPost, list, userToken, map[string]any{"name": "Bad Name", "kind": "http", "url": "https://example.com/mcp"}); status != http.StatusUnprocessableEntity {
		t.Fatalf("name that isn't a slug: %d, want 422", status)
	}

	command := map[string]any{"name": "local", "kind": "command", "command": "montara-no-such-binary", "args": []string{"--stdio"}}
	if status, _ := call(http.MethodPost, list, userToken, command); status != http.StatusForbidden {
		t.Fatalf("owner adds a command server: %d, want 403", status)
	}
	if status, out := call(http.MethodPost, list, superToken, command); status != http.StatusCreated || data(out)["status"] != models.MCPStatusError {
		t.Fatalf("super user adds a command server: %d %v", status, out)
	}

	status, out = call(http.MethodPost, list, userToken, map[string]any{"name": "notion", "kind": "hosted", "url": "https://mcp.example.com/mcp"})
	if status != http.StatusCreated || data(out)["status"] != models.MCPStatusNeedsAuth {
		t.Fatalf("add hosted server: %d %v", status, out)
	}
	if status, _ := call(http.MethodPost, list+"/test", userToken, map[string]any{"name": "notion", "kind": "hosted", "url": "https://mcp.example.com/mcp"}); status != http.StatusBadRequest {
		t.Fatalf("test a hosted draft: %d, want 400", status)
	}

	status, out = call(http.MethodGet, list, userToken, nil)
	if servers, _ := out["data"].([]any); status != http.StatusOK || len(servers) != 3 || out["metadata"].(map[string]any)["command_allowed"] != false {
		t.Fatalf("list: %d %v", status, out)
	}

	server := "/api/v1/mcp-servers/" + httpID
	if status, _ := call(http.MethodPut, server, userToken, map[string]any{"name": "exa", "kind": "command", "command": "x"}); status != http.StatusBadRequest {
		t.Fatalf("change the kind: %d, want 400", status)
	}
	// A blank value keeps the saved one; a new header needs one.
	if status, out := call(http.MethodPut, server, userToken, map[string]any{
		"name": "exa-search", "kind": "http", "url": "https://127.0.0.1:9/mcp",
		"headers": []map[string]string{{"name": "Authorization", "value": ""}},
	}); status != http.StatusOK || data(out)["name"] != "exa-search" {
		t.Fatalf("rename keeping the header: %d %v", status, out)
	}
	if status, _ := call(http.MethodPut, server, userToken, map[string]any{
		"name": "exa-search", "kind": "http", "url": "https://127.0.0.1:9/mcp",
		"headers": []map[string]string{{"name": "X-New", "value": ""}},
	}); status != http.StatusBadRequest {
		t.Fatalf("new header without a value: %d, want 400", status)
	}
	if status, _ := call(http.MethodPost, server+"/sync", userToken, nil); status != http.StatusBadGateway {
		t.Fatalf("sync an unreachable server: %d, want 502", status)
	}

	// A connected server with tools is what the agent offers; switched off,
	// it isn't.
	ctx := context.Background()
	repo := &application.Repositories.MCPServer
	id := uuid.MustParse(httpID)
	tools := []models.MCPTool{{Name: "web_search", Description: "Search the web", InputSchema: json.RawMessage(`{"type":"object"}`)}}
	if err := repo.SetStatus(ctx, id, models.MCPStatusConnected, "", tools); err != nil {
		t.Fatal(err)
	}
	if usable, err := repo.Usable(ctx, uuid.MustParse(userOrg)); err != nil || len(usable) != 1 || usable[0].Tools[0].Name != "web_search" {
		t.Fatalf("usable servers: %v %v", usable, err)
	}
	if status, _ := call(http.MethodPut, server, userToken, map[string]any{
		"name": "exa-search", "kind": "http", "url": "https://127.0.0.1:9/mcp", "is_enabled": false,
		"headers": []map[string]string{{"name": "Authorization", "value": ""}},
	}); status != http.StatusOK {
		t.Fatalf("switch off: %d", status)
	}
	if usable, _ := repo.Usable(ctx, uuid.MustParse(userOrg)); len(usable) != 0 {
		t.Fatalf("a switched-off server is still usable: %v", usable)
	}

	// End to end: a command server (this binary, over stdio) syncs its tool,
	// and the chat offers it to the model and runs it, its result wrapped as
	// outside data.
	status, out = call(http.MethodPost, list, superToken, map[string]any{
		"name": "echo-srv", "kind": "command", "command": os.Args[0],
		"env": []map[string]string{{"name": mcpStdioEnv, "value": "1"}},
	})
	if status != http.StatusCreated || data(out)["status"] != models.MCPStatusConnected || len(data(out)["tools"].([]any)) != 1 {
		t.Fatalf("add a working command server: %d %v", status, out)
	}
	fake := &mcpAgent{}
	application.AI = fake
	defer func() { application.AI = nil }()
	account := seedAccount(t, application, userOrg)
	status, body := callStream(http.MethodPost, "/api/v1/agent/chat", userToken, map[string]any{
		"email_account_id": account.ID,
		"message":          "Ask the echo server to say hi",
	})
	if status != http.StatusOK || !strings.Contains(body, "ran echo on echo-srv") || !strings.Contains(body, "The server said hi back.") {
		t.Fatalf("agent turn with an MCP tool: %d %s", status, body)
	}
	if result, _ := fake.result.Load().(string); !strings.Contains(result, "<mcp_result>\necho: hi\n</mcp_result>") {
		t.Fatalf("the tool result the model got: %q", result)
	}

	for _, s := range []string{httpID} {
		if status, _ := call(http.MethodDelete, "/api/v1/mcp-servers/"+s, userToken, nil); status != http.StatusOK {
			t.Fatalf("delete: %d", status)
		}
	}
	// The rest go with the organization's later cleanup; drop them now so
	// the other flows see an organization without MCP tools.
	servers, _ := repo.List(ctx, uuid.MustParse(userOrg))
	for _, s := range servers {
		if err := repo.Delete(ctx, s.ID); err != nil {
			t.Fatal(err)
		}
	}
}
