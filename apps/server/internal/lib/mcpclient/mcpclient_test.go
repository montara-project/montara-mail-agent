package mcpclient

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type greetArgs struct {
	Name string `json:"name" jsonschema:"who to greet"`
}

// testServer is an MCP server over Streamable HTTP with one tool, behind a
// check that the request carries the expected header.
func testServer(t *testing.T, header, value string) *httptest.Server {
	t.Helper()
	server := mcp.NewServer(&mcp.Implementation{Name: "test", Version: "1.0.0"}, nil)
	mcp.AddTool(server, &mcp.Tool{Name: "greet", Description: "Say hi"},
		func(_ context.Context, _ *mcp.CallToolRequest, args greetArgs) (*mcp.CallToolResult, any, error) {
			return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: "Hi " + args.Name}}}, nil, nil
		})
	handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return server }, nil)
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get(header) != value {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(ts.Close)
	return ts
}

// A server reached with its header lists its tools with their schema and
// runs them; a tool's own failure comes back flagged, not as a broken call.
func TestHTTPServer(t *testing.T) {
	ts := testServer(t, "X-Api-Key", "secret")
	ctx := context.Background()
	cfg := Config{Kind: KindHTTP, URL: ts.URL, Headers: map[string]string{"X-Api-Key": "secret"}}

	tools, err := ListTools(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) != 1 || tools[0].Name != "greet" || !strings.Contains(string(tools[0].InputSchema), `"name"`) {
		t.Fatalf("ListTools = %+v", tools)
	}

	session, err := Connect(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer session.Close()
	text, isError, err := CallTool(ctx, session, "greet", json.RawMessage(`{"name":"Ada"}`))
	if err != nil || isError || text != "Hi Ada" {
		t.Fatalf("CallTool = %q, %v, %v", text, isError, err)
	}
	// The SDK checks the schema first; either way it is a flagged result.
	text, isError, err = CallTool(ctx, session, "greet", json.RawMessage(`{}`))
	if err != nil || !isError || !strings.Contains(text, "name") {
		t.Fatalf("CallTool without a name = %q, %v, %v", text, isError, err)
	}
	if _, _, err := CallTool(ctx, session, "greet", json.RawMessage(`[1]`)); err == nil {
		t.Fatal("CallTool took arguments that aren't an object")
	}
}

// A refused header, or a bearer token where the server wants another, is
// ErrUnauthorized, so the UI can say "check the credentials" or "connect".
func TestUnauthorized(t *testing.T) {
	ts := testServer(t, "Authorization", "Bearer good")
	ctx := context.Background()

	if _, err := ListTools(ctx, Config{Kind: KindHTTP, URL: ts.URL}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("no header: %v, want ErrUnauthorized", err)
	}
	if _, err := ListTools(ctx, Config{Kind: KindHosted, URL: ts.URL, Token: "bad"}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("wrong token: %v, want ErrUnauthorized", err)
	}
	if _, err := ListTools(ctx, Config{Kind: KindHosted, URL: ts.URL, Token: "good"}); err != nil {
		t.Fatalf("right token: %v", err)
	}
}

// A command's environment holds PATH, HOME and its own variables, never the
// API's secrets.
func TestCommandEnv(t *testing.T) {
	t.Setenv("APP_SECRET", "do-not-leak")
	env := strings.Join(commandEnv(map[string]string{"TOKEN": "x"}), "\n")
	if strings.Contains(env, "do-not-leak") || !strings.Contains(env, "TOKEN=x") || !strings.Contains(env, "PATH=") {
		t.Fatalf("commandEnv = %q", env)
	}
}

func TestRenderResult(t *testing.T) {
	got := renderResult(&mcp.CallToolResult{StructuredContent: map[string]int{"n": 1}})
	if got != `{"n":1}` {
		t.Fatalf("structured only: %q", got)
	}
	if got := renderResult(&mcp.CallToolResult{}); got != "(the tool returned nothing)" {
		t.Fatalf("empty: %q", got)
	}
	if got := clip(strings.Repeat("a", maxResultLen+5)); !strings.HasSuffix(got, "[cut: the result was longer]") {
		t.Fatal("clip kept an over-long result")
	}
}
