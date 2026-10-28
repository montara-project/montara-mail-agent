package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// MCP server kinds and statuses (see migration 0013).
const (
	MCPKindHosted  = "hosted"
	MCPKindHTTP    = "http"
	MCPKindCommand = "command"

	MCPStatusPending   = "pending"
	MCPStatusConnected = "connected"
	MCPStatusNeedsAuth = "needs_auth"
	MCPStatusError     = "error"
)

// MCPServer is an MCP server an organization's agent may call tools on.
type MCPServer struct {
	Base
	OrganizationID uuid.UUID `db:"organization_id" json:"organization_id"`
	Name           string    `db:"name" json:"name"`
	Kind           string    `db:"kind" json:"kind"`
	URL            string    `db:"url" json:"url"`
	Command        string    `db:"command" json:"command"`
	Args           []string  `db:"args" json:"args"`
	// Secrets is the sealed MCPSecrets, never serialized.
	Secrets       []byte     `db:"secrets" json:"-"`
	Tools         []MCPTool  `db:"tools" json:"tools"`
	Status        string     `db:"status" json:"status"`
	StatusMessage string     `db:"status_message" json:"status_message"`
	SyncedAt      *time.Time `db:"synced_at" json:"synced_at"`
	IsEnabled     bool       `db:"is_enabled" json:"is_enabled"`
}

// MCPTool is a tool a server offered at its last sync; InputSchema is the
// JSON Schema of its arguments.
type MCPTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"input_schema"`
}
