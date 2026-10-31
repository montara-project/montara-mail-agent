package models

import (
	"time"

	"github.com/google/uuid"
)

// A recurring plan's billing interval (plans.billing_interval).
const (
	BillingMonth = "month"
	BillingYear  = "year"
)

// A subscription's lifecycle: created pending at checkout, active once
// BorderPay's webhook confirms the payment, then renewed from the wallet
// until it expires (no balance or auto-renew off).
const (
	SubscriptionStatusPending = "pending"
	SubscriptionStatusActive  = "active"
	SubscriptionStatusExpired = "expired"
)

// The wallet ledger's movement kinds (wallet_transactions.kind).
const (
	WalletKindTopup              = "topup"
	WalletKindSubscriptionCharge = "subscription_charge"
)

// Plan is one row of the pricing catalog: what a tier costs and what it
// allows. Limits are nil when unlimited. free and enterprise are display
// rows (no billing_interval): their limits still govern enforcement.
type Plan struct {
	ID               uuid.UUID  `json:"-"`
	CreatedAt        time.Time  `json:"-"`
	UpdatedAt        time.Time  `json:"-"`
	Code             string     `json:"code"`
	Name             string     `json:"name"`
	Description      string     `json:"description"`
	BillingInterval  *string    `json:"billing_interval"`
	Amount           int64      `json:"amount"`
	Currency         string     `json:"currency"`
	DiscountAmount   int64      `json:"discount_amount"`
	DiscountEndsAt   *time.Time `json:"discount_ends_at"`
	MaxEmailAccounts *int       `json:"max_email_accounts"`
	MaxOrganizations *int       `json:"max_organizations"`
	WeeklyTokens     *int64     `json:"weekly_tokens"`
	Active           bool       `json:"-"`
	SortOrder        int        `json:"-"`
}

// EffectivePrice returns what the plan costs right now: the list price less
// the promo discount while the promo is running.
func (p Plan) EffectivePrice(now time.Time) int64 {
	if p.DiscountAmount > 0 && (p.DiscountEndsAt == nil || p.DiscountEndsAt.After(now)) {
		return p.Amount - p.DiscountAmount
	}
	return p.Amount
}

// Discounted reports whether the plan is currently on promo.
func (p Plan) Discounted(now time.Time) bool {
	return p.EffectivePrice(now) < p.Amount
}

// Subscription is one paid period of a recurring plan, per user. The period
// is NULL until BorderPay's webhook confirms the checkout payment.
type Subscription struct {
	ID                 uuid.UUID  `json:"id"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"-"`
	UserID             uuid.UUID  `json:"-"`
	PlanID             uuid.UUID  `json:"-"`
	PlanCode           string     `json:"plan_code"`
	PlanName           string     `json:"plan_name"`
	BillingInterval    *string    `json:"billing_interval"`
	Status             string     `json:"status"`
	CurrentPeriodStart *time.Time `json:"current_period_start"`
	CurrentPeriodEnd   *time.Time `json:"current_period_end"`
	Amount             int64      `json:"amount"`
	Currency           string     `json:"currency"`
	ReferenceID        string     `json:"-"`
	PayURL             string     `json:"pay_url"`
	AutoRenew          bool       `json:"auto_renew"`
	CanceledAt         *time.Time `json:"canceled_at"`
}

// WalletBalance is a user's IDR balance for auto-renewing their subscription.
type WalletBalance struct {
	UserID     uuid.UUID `json:"-"`
	BalanceIDR int64     `json:"balance_idr"`
	UpdatedAt  time.Time `json:"-"`
}

// WalletTopup is one wallet top-up paid through BorderPay's QRIS checkout.
type WalletTopup struct {
	ID          uuid.UUID  `json:"id"`
	CreatedAt   time.Time  `json:"created_at"`
	UserID      uuid.UUID  `json:"-"`
	AmountIDR   int64      `json:"amount_idr"`
	Status      string     `json:"status"`
	ReferenceID string     `json:"-"`
	PayURL      string     `json:"pay_url"`
	PaidAt      *time.Time `json:"paid_at"`
}
