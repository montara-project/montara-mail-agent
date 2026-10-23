package models

import (
	"time"

	"github.com/google/uuid"
)

// EmailAccount is a mailbox connected over IMAP (see migration 000005).
type EmailAccount struct {
	Base
	OrganizationID uuid.UUID `db:"organization_id" json:"organization_id"`
	Provider       string    `db:"provider" json:"provider"`
	Label          string    `db:"label" json:"label"`
	Email          string    `db:"email" json:"email"`
	IMAPHost       string    `db:"imap_host" json:"imap_host"`
	IMAPPort       int       `db:"imap_port" json:"imap_port"`
	Username       string    `db:"username" json:"username"`
	// Password is sealed (see lib.SecretBox) and never serialized.
	Password  []byte     `db:"password" json:"-"`
	SyncedAt  *time.Time `db:"synced_at" json:"synced_at"`
	SyncError *string    `db:"sync_error" json:"sync_error"`

	// Counts filled by list queries; not columns.
	Unread int `db:"-" json:"unread"`
	Spam   int `db:"-" json:"spam"`
}
