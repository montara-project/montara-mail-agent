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
	EmailAccountID *uuid.UUID
	Provider       string
	Model          string
	Purpose        string
	InputTokens    int
	OutputTokens   int
}

// The purpose a usage row carries.
const (
	TokenPurposeChat     = "chat"
	TokenPurposeComplete = "complete"
)

// TokenBalance is a user's pay-as-you-go token balance: bought with top-ups,
// spent only once the weekly allowance runs out, and never expiring.
type TokenBalance struct {
	UserID        uuid.UUID
	BalanceTokens int64
	UpdatedAt     time.Time
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
	ID          uuid.UUID
	CreatedAt   time.Time
	UserID      uuid.UUID
	AmountIDR   int
	Tokens      int64
	Status      string
	ReferenceID string
	PayURL      string
	PaidAt      *time.Time
}
