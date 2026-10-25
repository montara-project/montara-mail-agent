package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ActivityLog is one recorded action a user took (see migration 000009): a
// sign-in, a change to their account, or a change inside an organization.
// Rows are written after the fact and never updated, so there is no
// updated_at.
type ActivityLog struct {
	ID        uuid.UUID `db:"id" json:"id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	// UserID is the actor; nil for an action with no signed-in caller that
	// still carries its starter in metadata.
	UserID *uuid.UUID `db:"user_id" json:"user_id"`
	// OrganizationID scopes the action to an organization; nil for the
	// user's own account actions.
	OrganizationID *uuid.UUID `db:"organization_id" json:"organization_id,omitempty"`
	Action         string     `db:"action" json:"action"`
	Description    string     `db:"description" json:"description"`
	// Metadata carries the action's details (a mail's subject, a mailbox's
	// provider); its shape follows from the action.
	Metadata json.RawMessage `db:"metadata" json:"metadata,omitempty"`
	// IP and UserAgent record where a sign-in came from.
	IP        string `db:"ip" json:"ip,omitempty"`
	UserAgent string `db:"user_agent" json:"-"`
	// ActorName and ActorEmail join the users mirror at read time; both are
	// empty when the actor is unknown.
	ActorName  string `db:"actor_name" json:"actor_name,omitempty"`
	ActorEmail string `db:"actor_email" json:"actor_email,omitempty"`
}
