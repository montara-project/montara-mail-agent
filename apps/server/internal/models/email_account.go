package models

import (
	"time"

	"github.com/google/uuid"
)

// EmailAccount is a mailbox connected over IMAP (see migration 000005). It
// signs in either with a sealed password or, for the providers that offer
// OAuth, with sealed tokens (see migration 000008); exactly one of the two
// is set.
type EmailAccount struct {
	Base
	OrganizationID uuid.UUID `db:"organization_id" json:"organization_id"`
	Provider       string    `db:"provider" json:"provider"`
	Label          string    `db:"label" json:"label"`
	Email          string    `db:"email" json:"email"`
	IMAPHost       string    `db:"imap_host" json:"imap_host"`
	IMAPPort       int       `db:"imap_port" json:"imap_port"`
	Username       string    `db:"username" json:"username"`
	SMTPHost       string    `db:"smtp_host" json:"smtp_host"`
	SMTPPort       int       `db:"smtp_port" json:"smtp_port"`
	// Password is sealed (see lib.SecretBox) and never serialized; nil for an
	// OAuth-connected account.
	Password []byte `db:"password" json:"-"`
	// The OAuth tokens are sealed like the password and never serialized;
	// the access one is refreshed when it expires.
	OAuthAccessToken  []byte     `db:"oauth_access_token" json:"-"`
	OAuthRefreshToken []byte     `db:"oauth_refresh_token" json:"-"`
	OAuthTokenExpiry  *time.Time `db:"oauth_token_expiry" json:"-"`
	SyncedAt          *time.Time `db:"synced_at" json:"synced_at"`
	SyncError         *string    `db:"sync_error" json:"sync_error"`

	// Counts filled by list queries; not columns.
	Unread int `db:"-" json:"unread"`
	Spam   int `db:"-" json:"spam"`
}
