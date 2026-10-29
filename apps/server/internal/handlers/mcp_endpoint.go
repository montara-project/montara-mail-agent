package handlers

import (
	"net/http"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/adaptor"

	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/mailagent"
)

// MCPPath is where MCP clients outside the app connect.
const MCPPath = "/mcp"

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
	return adaptor.HTTPHandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.mcp.ServeHTTP(w, r.WithContext(mailagent.WithMCPUser(r.Context(), uid)))
	})(c)
}
