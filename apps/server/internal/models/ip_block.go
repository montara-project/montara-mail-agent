package models

import (
	"time"

	"github.com/google/uuid"
)

// IP block sources (see migration 0014).
const (
	IPBlockManual = "manual"
	IPBlockAuto   = "auto"
)

// IPBlock is an address or range the API refuses. CreatedByEmail is read with
// it, for a manual block whose author still exists.
type IPBlock struct {
	Base
	Network        string     `db:"network" json:"network"`
	Source         string     `db:"source" json:"source"`
	Reason         string     `db:"reason" json:"reason"`
	ExpiresAt      *time.Time `db:"expires_at" json:"expires_at"`
	CreatedBy      *uuid.UUID `db:"created_by" json:"created_by"`
	CreatedByEmail *string    `db:"-" json:"created_by_email"`
}
