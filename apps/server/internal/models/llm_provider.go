package models

import (
	"time"

	"github.com/google/uuid"
)

// LLMProvider is the model AI features call (see migrations 000007 and
// 0012): an organization's own, or the platform one every organization
// without its own uses.
type LLMProvider struct {
	ID uuid.UUID `db:"id" json:"id"`
	// OrganizationID is nil for the platform provider.
	OrganizationID *uuid.UUID `db:"organization_id" json:"organization_id"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
	Name           string     `db:"name" json:"name"`
	Kind           string     `db:"kind" json:"kind"`
	BaseURL        string     `db:"base_url" json:"base_url"`
	Model          string     `db:"model" json:"model"`
	// APIKey is sealed (see lib.SecretBox) and never serialized.
	APIKey []byte `db:"api_key" json:"-"`
}
