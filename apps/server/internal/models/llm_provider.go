package models

import (
	"time"

	"github.com/google/uuid"
)

// LLMProvider is the model an organization's AI features call (see
// migration 000007).
type LLMProvider struct {
	OrganizationID uuid.UUID `db:"organization_id" json:"organization_id"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
	Kind           string    `db:"kind" json:"kind"`
	BaseURL        string    `db:"base_url" json:"base_url"`
	Model          string    `db:"model" json:"model"`
	// APIKey is sealed (see lib.SecretBox) and never serialized.
	APIKey []byte `db:"api_key" json:"-"`
}
