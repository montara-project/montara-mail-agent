package handlers

import (
	"bytes"
	"context"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/adaptor"

	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/mailagent"
)

// MCPPath is where MCP clients outside the app connect.
const MCPPath = "/mcp"

// mcpRequestLimit bounds one exchange. The adaptor's request context ends only
// at server shutdown, not when the client leaves, so without it a request the
// SDK holds open (or a mail server that never answers) would park forever.
const mcpRequestLimit = time.Minute

// mcpEndpointHandler serves the mailbox tools over MCP (see
// mailagent.NewMCPHandler) to the user middlewares.APIKey signed in.
type mcpEndpointHandler struct {
	mcp http.Handler
}

func (h *mcpEndpointHandler) Serve(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	scope := lib.ContextGetAPIKeyOrganization(c)
	// A JSON-RPC batch would run many tool calls under one request of the
	// rate limit; MCP clients send one message per POST.
	if body := bytes.TrimLeft(c.Body(), " \t\r\n"); len(body) > 0 && body[0] == '[' {
		return apperr.New(apperr.KindBadRequest, "JSON-RPC batches are not supported: send one message per request")
	}
	return adaptor.HTTPHandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(mailagent.WithMCPUser(r.Context(), uid, scope), mcpRequestLimit)
		defer cancel()
		h.mcp.ServeHTTP(w, r.WithContext(ctx))
	})(c)
}
