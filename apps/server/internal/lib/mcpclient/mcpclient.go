// Package mcpclient talks to the MCP servers an organization registers: a
// remote endpoint over Streamable HTTP (with headers, or an OAuth token) or
// a local command over stdio. It lists their tools and calls them for the
// mail agent.
package mcpclient

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// The kinds of server, by how they are reached.
const (
	KindHosted  = "hosted"  // HTTP with an OAuth token
	KindHTTP    = "http"    // HTTP with optional headers
	KindCommand = "command" // a local process over stdio
)

// maxResultLen bounds a tool result handed back to the model.
const maxResultLen = 20000

// Config is how to reach one server. HTTPClient is the guarded client
// (lib.GuardedDialer) every remote call goes through; Token, when set, is the
// OAuth access token sent as a bearer.
type Config struct {
	Kind       string
	URL        string
	Headers    map[string]string
	Command    string
	Args       []string
	Env        map[string]string
	Token      string
	HTTPClient *http.Client
}

// Tool is a tool a server offers, as the agent declares it to the model.
type Tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}

// ErrUnauthorized means the server refused the credentials: an OAuth server
// wants the user to connect (again), an HTTP one a better header.
var ErrUnauthorized = errors.New("the server refused the credentials")

// Connect opens a session; the caller closes it.
func Connect(ctx context.Context, cfg Config) (*mcp.ClientSession, error) {
	client := mcp.NewClient(&mcp.Implementation{Name: "montara-mail", Version: "1.0.0"}, nil)
	switch cfg.Kind {
	case KindHosted, KindHTTP:
		headers := cfg.Headers
		if cfg.Token != "" {
			headers = map[string]string{"Authorization": "Bearer " + cfg.Token}
		}
		base := cfg.HTTPClient
		if base == nil {
			base = http.DefaultClient
		}
		ht := &headerTransport{base: transportOf(base), headers: headers}
		// Server-initiated messages aren't used, so no standing SSE stream.
		session, err := client.Connect(ctx, &mcp.StreamableClientTransport{
			Endpoint:             cfg.URL,
			HTTPClient:           &http.Client{Transport: ht, Timeout: base.Timeout},
			MaxRetries:           -1,
			DisableStandaloneSSE: true,
		}, nil)
		if err != nil && ht.refused {
			return nil, ErrUnauthorized
		}
		return session, err
	case KindCommand:
		cmd := exec.CommandContext(ctx, cfg.Command, cfg.Args...)
		cmd.Env = commandEnv(cfg.Env)
		return client.Connect(ctx, &mcp.CommandTransport{Command: cmd}, nil)
	}
	return nil, fmt.Errorf("unknown MCP server kind %q", cfg.Kind)
}

// commandEnv is a command's environment: PATH and HOME, so the usual
// launchers (npx, uvx) resolve, and the server's own variables. Nothing else
// of the API's environment (APP_SECRET, DB_DSN) reaches the process.
func commandEnv(own map[string]string) []string {
	env := []string{}
	for _, key := range []string{"PATH", "HOME"} {
		if value, ok := os.LookupEnv(key); ok {
			env = append(env, key+"="+value)
		}
	}
	for key, value := range own {
		env = append(env, key+"="+value)
	}
	return env
}

// ListTools connects, lists every tool the server offers and closes.
func ListTools(ctx context.Context, cfg Config) ([]Tool, error) {
	session, err := Connect(ctx, cfg)
	if err != nil {
		return nil, err
	}
	defer session.Close()
	return SessionTools(ctx, session)
}

// SessionTools lists the tools of an open session, every page of them.
func SessionTools(ctx context.Context, session *mcp.ClientSession) ([]Tool, error) {
	tools := []Tool{}
	for tool, err := range session.Tools(ctx, nil) {
		if err != nil {
			return nil, err
		}
		schema, err := json.Marshal(tool.InputSchema)
		if err != nil || string(schema) == "null" {
			schema = json.RawMessage(`{"type":"object"}`)
		}
		tools = append(tools, Tool{Name: tool.Name, Description: tool.Description, InputSchema: schema})
	}
	return tools, nil
}

// CallTool runs one tool on an open session and renders its result as text
// for the model. isError marks a result the tool itself reported as failed.
func CallTool(ctx context.Context, session *mcp.ClientSession, name string, args json.RawMessage) (text string, isError bool, err error) {
	var arguments map[string]any
	if len(args) > 0 {
		if err := json.Unmarshal(args, &arguments); err != nil {
			return "", true, fmt.Errorf("the arguments aren't a JSON object: %w", err)
		}
	}
	result, err := session.CallTool(ctx, &mcp.CallToolParams{Name: name, Arguments: arguments})
	if err != nil {
		return "", true, err
	}
	return clip(renderResult(result)), result.IsError, nil
}

// renderResult joins a result's content: text as is, other content named by
// kind (the model gets no images or audio here), and the structured content
// as JSON when there is no text.
func renderResult(result *mcp.CallToolResult) string {
	var parts []string
	for _, content := range result.Content {
		switch c := content.(type) {
		case *mcp.TextContent:
			parts = append(parts, c.Text)
		case *mcp.ImageContent:
			parts = append(parts, "[an image the tool returned, not shown]")
		case *mcp.AudioContent:
			parts = append(parts, "[audio the tool returned, not shown]")
		case *mcp.ResourceLink:
			parts = append(parts, fmt.Sprintf("[resource %s: %s]", c.Name, c.URI))
		case *mcp.EmbeddedResource:
			if c.Resource != nil && c.Resource.Text != "" {
				parts = append(parts, c.Resource.Text)
			}
		}
	}
	if len(parts) == 0 && result.StructuredContent != nil {
		if b, err := json.Marshal(result.StructuredContent); err == nil {
			parts = append(parts, string(b))
		}
	}
	if len(parts) == 0 {
		return "(the tool returned nothing)"
	}
	return strings.Join(parts, "\n\n")
}

func clip(s string) string {
	if r := []rune(s); len(r) > maxResultLen {
		return string(r[:maxResultLen]) + "\n[cut: the result was longer]"
	}
	return s
}

// headerTransport adds a server's headers to every request and notes a 401,
// which the SDK otherwise reports as a generic connection failure.
type headerTransport struct {
	base    http.RoundTripper
	headers map[string]string
	refused bool
}

func (t *headerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	for key, value := range t.headers {
		req.Header.Set(key, value)
	}
	res, err := t.base.RoundTrip(req)
	if err == nil && res.StatusCode == http.StatusUnauthorized {
		t.refused = true
	}
	return res, err
}

func transportOf(c *http.Client) http.RoundTripper {
	if c.Transport != nil {
		return c.Transport
	}
	return http.DefaultTransport
}
