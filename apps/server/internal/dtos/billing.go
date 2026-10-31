package dtos

import "montara-mail-agent/server/internal/lib/validator"

// BillingCheckoutBody is the subscription checkout payload.
type BillingCheckoutBody struct {
	PlanCode string `json:"plan_code"`
}

func (dto BillingCheckoutBody) Validate(v *validator.MapValidator) {
	v.Field("plan_code").Required().String().MaxLen(64)
}

// BillingAutoRenewBody is the auto-renew toggle payload.
type BillingAutoRenewBody struct {
	Enabled bool `json:"enabled"`
}

func (dto BillingAutoRenewBody) Validate(v *validator.MapValidator) {
	// A bool needs nothing beyond its presence in the JSON body.
	v.Field("enabled")
}

// BillingWalletTopupBody is the wallet top-up payload; the amount is rupiah.
type BillingWalletTopupBody struct {
	AmountIDR int64 `json:"amount_idr"`
}

func (dto BillingWalletTopupBody) Validate(v *validator.MapValidator) {
	v.Field("amount_idr").Required()
}
