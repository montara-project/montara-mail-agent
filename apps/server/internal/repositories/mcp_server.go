package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// MCPServerRepository manages the organizations' MCP servers (see migration
// 0013).
type MCPServerRepository struct {
	BaseRepository
}

const mcpServerColumns = `id, created_at, updated_at, organization_id, name, kind, url, command, args, secrets,
	tools, status, status_message, synced_at, is_enabled`

func scanMCPServer(row rowScanner) (models.MCPServer, error) {
	var s models.MCPServer
	var args, tools []byte
	var syncedAt sql.NullTime
	err := row.Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt, &s.OrganizationID, &s.Name, &s.Kind, &s.URL, &s.Command,
		&args, &s.Secrets, &tools, &s.Status, &s.StatusMessage, &syncedAt, &s.IsEnabled)
	if err != nil {
		return s, translateNotFound("mcp_servers", err)
	}
	if syncedAt.Valid {
		s.SyncedAt = &syncedAt.Time
	}
	s.Args, s.Tools = []string{}, []models.MCPTool{}
	_ = json.Unmarshal(args, &s.Args)
	_ = json.Unmarshal(tools, &s.Tools)
	return s, nil
}

// List returns an organization's servers by name.
func (r *MCPServerRepository) List(ctx context.Context, orgID uuid.UUID) ([]models.MCPServer, error) {
	rows, err := r.queryContext(ctx, `SELECT `+mcpServerColumns+` FROM mcp_servers
		WHERE organization_id = $1 ORDER BY name`, orgID)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanMCPServer)
}

// Usable returns the servers whose tools the agent offers: switched on,
// connected, with at least one tool.
func (r *MCPServerRepository) Usable(ctx context.Context, orgID uuid.UUID) ([]models.MCPServer, error) {
	rows, err := r.queryContext(ctx, `SELECT `+mcpServerColumns+` FROM mcp_servers
		WHERE organization_id = $1 AND is_enabled AND status = $2 AND jsonb_array_length(tools) > 0
		ORDER BY name`, orgID, models.MCPStatusConnected)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanMCPServer)
}

// Get returns one server.
func (r *MCPServerRepository) Get(ctx context.Context, id uuid.UUID) (models.MCPServer, error) {
	return scanMCPServer(r.queryRowContext(ctx, `SELECT `+mcpServerColumns+` FROM mcp_servers WHERE id = $1`, id))
}

const duplicateMCPName = "the organization already has an MCP server with this name"

// Create inserts a server, filling in its id and timestamps.
func (r *MCPServerRepository) Create(ctx context.Context, s *models.MCPServer) error {
	args, _ := json.Marshal(s.Args)
	err := r.queryRowContext(ctx, `
		INSERT INTO mcp_servers (organization_id, name, kind, url, command, args, secrets, is_enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at, status`,
		s.OrganizationID, s.Name, s.Kind, s.URL, s.Command, args, s.Secrets, s.IsEnabled,
	).Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt, &s.Status)
	return translateUnique(err, duplicateMCPName)
}

// Update saves a server's settings; a changed endpoint or command puts it
// back to pending, since its tools may no longer be the ones listed.
func (r *MCPServerRepository) Update(ctx context.Context, s models.MCPServer, reset bool) error {
	args, _ := json.Marshal(s.Args)
	res, err := r.execContext(ctx, `
		UPDATE mcp_servers SET name = $2, url = $3, command = $4, args = $5, secrets = $6, is_enabled = $7,
			status = CASE WHEN $8 THEN 'pending' ELSE status END,
			status_message = CASE WHEN $8 THEN '' ELSE status_message END,
			updated_at = now()
		WHERE id = $1`,
		s.ID, s.Name, s.URL, s.Command, args, s.Secrets, s.IsEnabled, reset,
	)
	if err != nil {
		return translateUnique(err, duplicateMCPName)
	}
	return requireAffected(res, "MCP server")
}

// SetSecrets replaces a server's sealed secrets, e.g. a refreshed token.
func (r *MCPServerRepository) SetSecrets(ctx context.Context, id uuid.UUID, secrets []byte) error {
	_, err := r.execContext(ctx, `UPDATE mcp_servers SET secrets = $2, updated_at = now() WHERE id = $1`, id, secrets)
	return err
}

// SetStatus records how the last contact went; tools, when not nil, replace
// the synced list (a successful sync).
func (r *MCPServerRepository) SetStatus(ctx context.Context, id uuid.UUID, status, message string, tools []models.MCPTool) error {
	if tools == nil {
		_, err := r.execContext(ctx, `UPDATE mcp_servers SET status = $2, status_message = $3, updated_at = now()
			WHERE id = $1`, id, status, message)
		return err
	}
	list, _ := json.Marshal(tools)
	_, err := r.execContext(ctx, `UPDATE mcp_servers SET status = $2, status_message = $3, tools = $4, synced_at = $5,
		updated_at = now() WHERE id = $1`, id, status, message, list, time.Now())
	return err
}

// Delete removes a server.
func (r *MCPServerRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM mcp_servers WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "MCP server")
}
