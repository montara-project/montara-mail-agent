// Package mcptools connects an organization's stored MCP servers: it opens
// their sealed secrets, keeps hosted servers' OAuth tokens fresh, and syncs
// the tools the agent offers the model.
package mcptools

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/mcpclient"
	"montara-mail-agent/server/internal/models"
)

// Timeout bounds connecting to a server and listing its tools.
const Timeout = 20 * time.Second

// Secrets is what a server's secrets column holds, sealed: header and
// environment values, and a hosted server's OAuth client and token.
type Secrets struct {
	Headers map[string]string `json:"headers,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
	OAuth   *mcpclient.OAuth  `json:"oauth,omitempty"`
}

// OpenSecrets reads a server's sealed secrets; a server without any has
// empty ones.
func OpenSecrets(a *app.Application, s models.MCPServer) (Secrets, error) {
	var sec Secrets
	if len(s.Secrets) == 0 {
		return sec, nil
	}
	plain, err := a.Secrets.Open(s.Secrets)
	if err != nil {
		return sec, errors.New("the server's saved credentials can't be read; enter them again")
	}
	if err := json.Unmarshal([]byte(plain), &sec); err != nil {
		return sec, err
	}
	return sec, nil
}

// SealSecrets seals secrets for the secrets column.
func SealSecrets(a *app.Application, sec Secrets) []byte {
	plain, _ := json.Marshal(sec)
	return a.Secrets.Seal(string(plain))
}

// Config is how to reach a stored server. A hosted server's expired token is
// refreshed here and the new one saved; one that can't be refreshed is
// mcpclient.ErrUnauthorized, meaning the user must connect again.
func Config(ctx context.Context, a *app.Application, s models.MCPServer) (mcpclient.Config, error) {
	cfg := mcpclient.Config{Kind: s.Kind, URL: s.URL, Command: s.Command, Args: s.Args, HTTPClient: a.HTTPClient}
	sec, err := OpenSecrets(a, s)
	if err != nil {
		return cfg, err
	}
	cfg.Headers, cfg.Env = sec.Headers, sec.Env
	if s.Kind != models.MCPKindHosted {
		return cfg, nil
	}
	if sec.OAuth == nil {
		return cfg, mcpclient.ErrUnauthorized
	}
	token, changed, err := sec.OAuth.Fresh(ctx, a.HTTPClient)
	if err != nil {
		return cfg, err
	}
	if changed {
		sec.OAuth.Token = token
		if err := a.Repositories.MCPServer.SetSecrets(ctx, s.ID, SealSecrets(a, sec)); err != nil {
			return cfg, err
		}
	}
	cfg.Token = token.AccessToken
	return cfg, nil
}

// Connect opens a session to a stored server; the caller closes it.
func Connect(ctx context.Context, a *app.Application, s models.MCPServer) (*mcp.ClientSession, error) {
	cfg, err := Config(ctx, a, s)
	if err != nil {
		return nil, err
	}
	return mcpclient.Connect(ctx, cfg)
}

// Sync lists a stored server's tools and records the outcome: the tools and
// "connected", or the status and message that say what went wrong. keep
// false records only the status (a connection test).
func Sync(ctx context.Context, a *app.Application, s models.MCPServer, keep bool) ([]models.MCPTool, error) {
	ctx, cancel := context.WithTimeout(ctx, Timeout)
	defer cancel()

	cfg, err := Config(ctx, a, s)
	var tools []mcpclient.Tool
	if err == nil {
		tools, err = mcpclient.ListTools(ctx, cfg)
	}
	repo := &a.Repositories.MCPServer
	if err != nil {
		status, message := Failure(s.Kind, err)
		if serr := repo.SetStatus(context.WithoutCancel(ctx), s.ID, status, message, nil); serr != nil {
			return nil, serr
		}
		return nil, errors.New(message)
	}

	list := ToModel(tools)
	if !keep {
		return list, repo.SetStatus(ctx, s.ID, models.MCPStatusConnected, "", nil)
	}
	return list, repo.SetStatus(ctx, s.ID, models.MCPStatusConnected, "", list)
}

// Failure turns a failed contact into a status and a message for the user.
func Failure(kind string, err error) (status, message string) {
	switch {
	case errors.Is(err, mcpclient.ErrUnauthorized) && kind == models.MCPKindHosted:
		return models.MCPStatusNeedsAuth, "Connect the server to sign in"
	case errors.Is(err, mcpclient.ErrUnauthorized):
		return models.MCPStatusError, "The server refused the credentials: check the headers"
	case errors.Is(err, context.DeadlineExceeded):
		return models.MCPStatusError, fmt.Sprintf("The server didn't answer within %s", Timeout)
	}
	return models.MCPStatusError, "Couldn't reach the server: " + err.Error()
}

// ToModel converts listed tools into the stored form.
func ToModel(tools []mcpclient.Tool) []models.MCPTool {
	list := make([]models.MCPTool, len(tools))
	for i, t := range tools {
		list[i] = models.MCPTool{Name: t.Name, Description: t.Description, InputSchema: t.InputSchema}
	}
	return list
}

// RedirectURI is where a hosted server's sign-in returns the browser.
func RedirectURI(baseURL string) string {
	return baseURL + "/api/v1/mcp-servers/oauth/callback"
}
