package repositories

import (
	"context"
	"database/sql"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// AgentSkillRepository manages the skills: the users' custom ones, and the
// organizations' switch and agent bot of the built-in ones (see migrations
// 0011 and 0020).
type AgentSkillRepository struct {
	BaseRepository
}

const agentSkillColumns = `id, created_at, updated_at, organization_id, user_id, builtin, name, description, instruction, agent_bot_id, is_enabled, deleted_at`

func scanAgentSkill(row rowScanner) (models.AgentSkill, error) {
	var s models.AgentSkill
	var orgID uuid.NullUUID
	var builtin sql.NullString
	var deletedAt sql.NullTime
	err := row.Scan(&s.ID, &s.CreatedAt, &s.UpdatedAt, &orgID, &s.UserID, &builtin, &s.Name, &s.Description,
		&s.Instruction, &s.AgentBotID, &s.IsEnabled, &deletedAt)
	if err != nil {
		return s, translateNotFound("agent_skills", err)
	}
	s.OrganizationID = orgID.UUID
	if builtin.Valid {
		s.Builtin = &builtin.String
	}
	if deletedAt.Valid {
		s.DeletedAt = &deletedAt.Time
	}
	return s, nil
}

// List returns the live skill rows userID sees in an organization, oldest
// first: the built-in ones the organization has changed, and the user's own
// custom skills.
func (r *AgentSkillRepository) List(ctx context.Context, orgID, userID uuid.UUID) ([]models.AgentSkill, error) {
	rows, err := r.queryContext(ctx, `
		SELECT `+agentSkillColumns+` FROM agent_skills
		WHERE deleted_at IS NULL
			AND ((builtin IS NOT NULL AND organization_id = $1) OR (builtin IS NULL AND user_id = $2))
		ORDER BY created_at`,
		orgID, userID,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanAgentSkill)
}

// Get returns one live custom skill by id.
func (r *AgentSkillRepository) Get(ctx context.Context, id uuid.UUID) (models.AgentSkill, error) {
	query := `SELECT ` + agentSkillColumns + ` FROM agent_skills
		WHERE id = $1 AND builtin IS NULL AND deleted_at IS NULL`
	return scanAgentSkill(r.queryRowContext(ctx, query, id))
}

// Builtin returns the organization's row for a built-in skill, or a
// not-found error while it has not changed that skill.
func (r *AgentSkillRepository) Builtin(ctx context.Context, orgID uuid.UUID, key string) (models.AgentSkill, error) {
	query := `SELECT ` + agentSkillColumns + ` FROM agent_skills
		WHERE organization_id = $1 AND builtin = $2`
	return scanAgentSkill(r.queryRowContext(ctx, query, orgID, key))
}

// SetBuiltin stores the organization's switch and agent bot for a built-in
// skill, making its row on the first change.
func (r *AgentSkillRepository) SetBuiltin(ctx context.Context, orgID uuid.UUID, key string, enabled bool, botID *uuid.UUID) error {
	_, err := r.execContext(ctx, `
		INSERT INTO agent_skills (organization_id, builtin, is_enabled, agent_bot_id)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (organization_id, builtin) WHERE builtin IS NOT NULL
		DO UPDATE SET is_enabled = EXCLUDED.is_enabled, agent_bot_id = EXCLUDED.agent_bot_id, updated_at = now()`,
		orgID, key, enabled, botID,
	)
	return err
}

// Create stores a new custom skill for s.UserID.
func (r *AgentSkillRepository) Create(ctx context.Context, s *models.AgentSkill) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	s.ID = id
	_, err = r.execContext(ctx, `
		INSERT INTO agent_skills (id, user_id, name, description, instruction, is_enabled)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		s.ID, s.UserID, s.Name, s.Description, s.Instruction, s.IsEnabled,
	)
	return err
}

// Update rewrites a custom skill's fields.
func (r *AgentSkillRepository) Update(ctx context.Context, s models.AgentSkill) error {
	res, err := r.execContext(ctx, `
		UPDATE agent_skills SET name = $2, description = $3, instruction = $4, is_enabled = $5, updated_at = now()
		WHERE id = $1 AND builtin IS NULL AND deleted_at IS NULL`,
		s.ID, s.Name, s.Description, s.Instruction, s.IsEnabled,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "skill")
}

// Delete hides a custom skill.
func (r *AgentSkillRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE agent_skills SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND builtin IS NULL AND deleted_at IS NULL`, id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "skill")
}
