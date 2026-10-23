package models

import (
	"time"

	"github.com/google/uuid"
)

// MailContact is one address of a To or Cc line.
type MailContact struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

// Mail is one message synced from an IMAP folder (see migration 000006).
type Mail struct {
	Base
	EmailAccountID uuid.UUID     `db:"email_account_id" json:"email_account_id"`
	Folder         string        `db:"folder" json:"folder"`
	UIDValidity    uint32        `db:"uid_validity" json:"-"`
	UID            uint32        `db:"uid" json:"-"`
	MessageID      string        `db:"message_id" json:"message_id"`
	FromName       string        `db:"from_name" json:"from_name"`
	FromEmail      string        `db:"from_email" json:"from_email"`
	To             []MailContact `db:"to" json:"to"`
	Cc             []MailContact `db:"cc" json:"cc"`
	Subject        string        `db:"subject" json:"subject"`
	// Body is left out of list answers, which carry Teaser instead.
	Body         string    `db:"body" json:"body,omitempty"`
	Teaser       string    `db:"-" json:"teaser,omitempty"`
	ReceivedAt   time.Time `db:"received_at" json:"received_at"`
	IsRead       bool      `db:"is_read" json:"is_read"`
	IsStarred    bool      `db:"is_starred" json:"is_starred"`
	Importance   *string   `db:"importance" json:"importance"`
	ImportanceBy *string   `db:"importance_by" json:"importance_by"`
	Summary      *string   `db:"summary" json:"-"`
}
