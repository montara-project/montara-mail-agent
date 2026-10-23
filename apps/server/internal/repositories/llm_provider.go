package repositories

import (
	"context"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// LLMProviderRepository manages each organization's LLM settings.
type LLMProviderRepository struct {
	BaseRepository
}

// Get returns an organization's provider, or a not-found error when it has none.
func (r *LLMProviderRepository) Get(ctx context.Context, organizationID uuid.UUID) (models.LLMProvider, error) {
	var p models.LLMProvider
	err := r.queryRowContext(ctx, `
		SELECT organization_id, created_at, updated_at, kind, base_url, model, api_key
		FROM llm_providers WHERE organization_id = $1`,
		organizationID,
	).Scan(&p.OrganizationID, &p.CreatedAt, &p.UpdatedAt, &p.Kind, &p.BaseURL, &p.Model, &p.APIKey)
	return p, translateNotFound("llm_providers", err)
}

// Upsert creates or replaces an organization's provider.
func (r *LLMProviderRepository) Upsert(ctx context.Context, p models.LLMProvider) error {
	_, err := r.execContext(ctx, `
		INSERT INTO llm_providers (organization_id, kind, base_url, model, api_key)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (organization_id) DO UPDATE
		SET kind = EXCLUDED.kind, base_url = EXCLUDED.base_url, model = EXCLUDED.model,
			api_key = EXCLUDED.api_key, updated_at = now()`,
		p.OrganizationID, p.Kind, p.BaseURL, p.Model, p.APIKey,
	)
	return err
}

// Delete removes an organization's provider.
func (r *LLMProviderRepository) Delete(ctx context.Context, organizationID uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM llm_providers WHERE organization_id = $1`, organizationID)
	if err != nil {
		return err
	}
	return requireAffected(res, "LLM provider")
}
