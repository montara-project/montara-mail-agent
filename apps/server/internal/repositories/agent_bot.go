package repositories

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// AgentBotRepository manages the organizations' AI agent personas
// (see migration 0011).
type AgentBotRepository struct {
	BaseRepository
}

const agentBotColumns = `id, created_at, updated_at, organization_id, name, description, soul, memory, style, instruction, is_default, deleted_at`

func scanAgentBot(row rowScanner) (models.AgentBot, error) {
	var b models.AgentBot
	var deletedAt sql.NullTime
	err := row.Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt, &b.OrganizationID, &b.Name, &b.Description,
		&b.Soul, &b.Memory, &b.Style, &b.Instruction, &b.IsDefault, &deletedAt)
	if err != nil {
		return b, translateNotFound("agent_bots", err)
	}
	if deletedAt.Valid {
		b.DeletedAt = &deletedAt.Time
	}
	return b, nil
}

// List returns an organization's live bots, the default first, then newest.
func (r *AgentBotRepository) List(ctx context.Context, orgID uuid.UUID) ([]models.AgentBot, error) {
	rows, err := r.queryContext(ctx, `
		SELECT `+agentBotColumns+` FROM agent_bots
		WHERE organization_id = $1 AND deleted_at IS NULL
		ORDER BY is_default DESC, created_at DESC`,
		orgID,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanAgentBot)
}

// Get returns one live bot by id.
func (r *AgentBotRepository) Get(ctx context.Context, id uuid.UUID) (models.AgentBot, error) {
	query := `SELECT ` + agentBotColumns + ` FROM agent_bots WHERE id = $1 AND deleted_at IS NULL`
	return scanAgentBot(r.queryRowContext(ctx, query, id))
}

// Default returns the organization's default bot, or a not-found error when
// it has none.
func (r *AgentBotRepository) Default(ctx context.Context, orgID uuid.UUID) (models.AgentBot, error) {
	query := `SELECT ` + agentBotColumns + ` FROM agent_bots
		WHERE organization_id = $1 AND is_default AND deleted_at IS NULL
		ORDER BY created_at LIMIT 1`
	return scanAgentBot(r.queryRowContext(ctx, query, orgID))
}

// clearOtherDefaults drops the default flag from an organization's other live
// bots, so at most one carries it (the partial unique index guards the rest).
func clearOtherDefaults(ctx context.Context, tx *sql.Tx, orgID, exceptID uuid.UUID) error {
	_, err := tx.ExecContext(ctx, `
		UPDATE agent_bots SET is_default = false, updated_at = now()
		WHERE organization_id = $1 AND is_default AND id <> $2 AND deleted_at IS NULL`,
		orgID, exceptID,
	)
	return err
}

// Create stores a new bot; with IsDefault it first clears the organization's
// other default, in the same transaction.
func (r *AgentBotRepository) Create(ctx context.Context, b *models.AgentBot) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	b.ID = id
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // nothing to roll back after a commit
	if b.IsDefault {
		if err := clearOtherDefaults(ctx, tx, b.OrganizationID, b.ID); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO agent_bots (id, organization_id, name, description, soul, memory, style, instruction, is_default)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		b.ID, b.OrganizationID, b.Name, b.Description, b.Soul, b.Memory, b.Style, b.Instruction, b.IsDefault,
	); err != nil {
		return err
	}
	return tx.Commit()
}

// Update rewrites a bot's fields; with IsDefault it first clears the
// organization's other default, in the same transaction.
func (r *AgentBotRepository) Update(ctx context.Context, b models.AgentBot) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // nothing to roll back after a commit
	if b.IsDefault {
		if err := clearOtherDefaults(ctx, tx, b.OrganizationID, b.ID); err != nil {
			return err
		}
	}
	res, err := tx.ExecContext(ctx, `
		UPDATE agent_bots SET name = $2, description = $3, soul = $4, memory = $5, style = $6,
			instruction = $7, is_default = $8, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		b.ID, b.Name, b.Description, b.Soul, b.Memory, b.Style, b.Instruction, b.IsDefault,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return translateNotFound("agent_bots", sql.ErrNoRows)
	}
	return tx.Commit()
}

// Delete hides a bot instead of removing it, so drafts it drafted keep their
// reference; the default flag goes with it.
func (r *AgentBotRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE agent_bots SET deleted_at = now(), is_default = false, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "agent bot")
}
