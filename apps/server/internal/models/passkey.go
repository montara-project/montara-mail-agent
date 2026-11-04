package models

import (
	"time"

	"github.com/go-webauthn/webauthn/webauthn"
	"github.com/google/uuid"
)

// Passkey is a WebAuthn credential a user signs in with (see migration 0021).
// The credential record never leaves the server.
type Passkey struct {
	ID         uuid.UUID           `json:"id"`
	CreatedAt  time.Time           `json:"created_at"`
	UserID     uuid.UUID           `json:"-"`
	Name       string              `json:"name"`
	Credential webauthn.Credential `json:"-"`
	LastUsedAt *time.Time          `json:"last_used_at"`
}
