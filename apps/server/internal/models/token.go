package models

import (
	"time"

	"github.com/google/uuid"
)

// TokenUsage is one LLM call's token accounting, attributed to the user whose
// quota it draws from (tera-router's usage_records pattern).
type TokenUsage struct {
	ID             uuid.UUID
	CreatedAt      time.Time
	UserID         uuid.UUID
	OrganizationID *uuid.UUID
	Provider       string
	Model          string
	Purpose        string
	InputTokens    int
	OutputTokens   int
	// WeeklyLimit is the allowance the user's plan had at the call; nil when
	// their tier is unlimited.
	WeeklyLimit *int64
}

// A token top-up's lifecycle: created pending, BorderPay's webhook flips it
// to paid, which credits the balance. expired/failed close it unspent.
const (
	TopupStatusPending = "pending"
	TopupStatusPaid    = "paid"
	TopupStatusExpired = "expired"
	TopupStatusFailed  = "failed"
)

// TokenTopup is one pay-as-you-go purchase: 10M tokens per Rp10,000, paid
// through BorderPay and never expiring.
type TokenTopup struct {
	ID          uuid.UUID  `json:"id"`
	CreatedAt   time.Time  `json:"created_at"`
	UserID      uuid.UUID  `json:"-"`
	AmountIDR   int        `json:"amount_idr"`
	Tokens      int64      `json:"tokens"`
	Status      string     `json:"status"`
	ReferenceID string     `json:"reference_id"`
	PayURL      string     `json:"pay_url"`
	PaidAt      *time.Time `json:"paid_at"`
}
