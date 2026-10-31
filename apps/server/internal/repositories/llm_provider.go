package repositories

import (
	"context"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// LLMProviderRepository manages the LLM providers: one per organization at
// most, and one global. A scope is an organization id, or nil for global.
type LLMProviderRepository struct {
	BaseRepository
}

const llmProviderColumns = `id, organization_id, platform_user, created_at, updated_at, name, kind, base_url, model, api_key`

func scanLLMProvider(row rowScanner) (models.LLMProvider, error) {
	var p models.LLMProvider
	err := row.Scan(&p.ID, &p.OrganizationID, &p.PlatformUser, &p.CreatedAt, &p.UpdatedAt, &p.Name, &p.Kind, &p.BaseURL, &p.Model, &p.APIKey)
	return p, translateNotFound("llm_providers", err)
}

// Get returns the provider of a scope, or a not-found error when it has none.
func (r *LLMProviderRepository) Get(ctx context.Context, scope *uuid.UUID) (models.LLMProvider, error) {
	return scanLLMProvider(r.queryRowContext(ctx, `
		SELECT `+llmProviderColumns+` FROM llm_providers
		WHERE organization_id IS NOT DISTINCT FROM $1`,
		scope,
	))
}

// GetByID returns one provider by id.
func (r *LLMProviderRepository) GetByID(ctx context.Context, id uuid.UUID) (models.LLMProvider, error) {
	return scanLLMProvider(r.queryRowContext(ctx, `SELECT `+llmProviderColumns+` FROM llm_providers WHERE id = $1`, id))
}

// ForOrganization returns the provider an organization's AI features call:
// its own, else the global one, else a not-found error.
func (r *LLMProviderRepository) ForOrganization(ctx context.Context, organizationID uuid.UUID) (models.LLMProvider, error) {
	return scanLLMProvider(r.queryRowContext(ctx, `
		SELECT `+llmProviderColumns+` FROM llm_providers
		WHERE organization_id = $1 OR organization_id IS NULL
		ORDER BY organization_id NULLS LAST LIMIT 1`,
		organizationID,
	))
}

// LLMProviderListed is a provider with the name of the organization it
// belongs to ("" for the global one).
type LLMProviderListed struct {
	models.LLMProvider
	OrganizationName string `json:"organization_name"`
}

// List returns the global provider and those of the user's organizations,
// or every provider for a super user; the global one first.
func (r *LLMProviderRepository) List(ctx context.Context, userID uuid.UUID, all bool) ([]LLMProviderListed, error) {
	rows, err := r.queryContext(ctx, `
		SELECT p.id, p.organization_id, p.platform_user, p.created_at, p.updated_at, p.name, p.kind, p.base_url, p.model, p.api_key,
			COALESCE(o.name, CASE WHEN p.platform_user THEN 'Platform (users)' ELSE '' END)
		FROM llm_providers p
		LEFT JOIN organizations o ON o.id = p.organization_id
		WHERE $2 OR p.organization_id IS NULL
			OR p.organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = $1)
		ORDER BY p.organization_id NULLS FIRST, o.name`,
		userID, all,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, func(row rowScanner) (LLMProviderListed, error) {
		var l LLMProviderListed
		p := &l.LLMProvider
		err := row.Scan(&p.ID, &p.OrganizationID, &p.PlatformUser, &p.CreatedAt, &p.UpdatedAt, &p.Name, &p.Kind, &p.BaseURL, &p.Model, &p.APIKey,
			&l.OrganizationName)
		return l, err
	})
}

// Upsert creates or replaces the provider of p's scope.
func (r *LLMProviderRepository) Upsert(ctx context.Context, p models.LLMProvider) error {
	_, err := r.execContext(ctx, `
		INSERT INTO llm_providers (organization_id, platform_user, name, kind, base_url, model, api_key)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (organization_id, platform_user) DO UPDATE
		SET platform_user = EXCLUDED.platform_user, name = EXCLUDED.name, kind = EXCLUDED.kind, base_url = EXCLUDED.base_url, model = EXCLUDED.model,
			api_key = EXCLUDED.api_key, updated_at = now()`,
		p.OrganizationID, p.PlatformUser, p.Name, p.Kind, p.BaseURL, p.Model, p.APIKey,
	)
	return err
}

// SetScope moves a provider to another scope; a scope that already has one
// is a conflict.
func (r *LLMProviderRepository) SetScope(ctx context.Context, id uuid.UUID, scope *uuid.UUID, platform bool) error {
	res, err := r.execContext(ctx, `
		UPDATE llm_providers SET organization_id = $2, platform_user = $3, updated_at = now() WHERE id = $1`,
		id, scope, platform,
	)
	if err != nil {
		message := "that organization already has a provider: remove it first"
		if scope == nil {
			message = "there is already a global provider: remove it first"
		}
		if platform {
			message = "there is already a platform-user provider: remove it first"
		}
		return translateUnique(err, message)
	}
	return requireAffected(res, "LLM provider")
}

// Delete removes the provider of a scope.
func (r *LLMProviderRepository) Delete(ctx context.Context, scope *uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM llm_providers WHERE organization_id IS NOT DISTINCT FROM $1`, scope)
	if err != nil {
		return err
	}
	return requireAffected(res, "LLM provider")
}

// ForScope returns the provider an AI call resolves to: the organization's
// own, else the platform-user one when platformUser, else the global one,
// else a not-found error.
func (r *LLMProviderRepository) ForScope(ctx context.Context, organizationID *uuid.UUID, platformUser bool) (models.LLMProvider, error) {
	if organizationID != nil {
		p, err := scanLLMProvider(r.queryRowContext(ctx, `
			SELECT `+llmProviderColumns+` FROM llm_providers WHERE organization_id = $1`,
			*organizationID,
		))
		if translateNotFound("llm_providers", err) == nil {
			return p, nil
		}
	}
	if platformUser {
		p, err := scanLLMProvider(r.queryRowContext(ctx, `
			SELECT `+llmProviderColumns+` FROM llm_providers WHERE platform_user`,
		))
		if translateNotFound("llm_providers", err) == nil {
			return p, nil
		}
	}
	return scanLLMProvider(r.queryRowContext(ctx, `
		SELECT `+llmProviderColumns+` FROM llm_providers WHERE organization_id IS NULL AND NOT platform_user`,
	))
}

// GetPlatform returns the platform-user provider, or a not-found error.
func (r *LLMProviderRepository) GetPlatform(ctx context.Context) (models.LLMProvider, error) {
	return scanLLMProvider(r.queryRowContext(ctx, `
		SELECT `+llmProviderColumns+` FROM llm_providers WHERE platform_user AND organization_id IS NULL`,
	))
}

// DeletePlatform removes the platform-user provider.
func (r *LLMProviderRepository) DeletePlatform(ctx context.Context) error {
	res, err := r.execContext(ctx, `DELETE FROM llm_providers WHERE platform_user AND organization_id IS NULL`)
	if err != nil {
		return err
	}
	return requireAffected(res, "LLM provider")
}
