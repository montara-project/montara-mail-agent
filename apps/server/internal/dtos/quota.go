package dtos

import "montara-mail-agent/server/internal/lib/validator"

// QuotaTopupBody is a pay-as-you-go token purchase: the token count, priced
// Rp1.000 per 1M tokens, and how it is paid: "wallet" (the default) debits the
// IDR wallet at once, "gateway" opens a BorderPay QRIS checkout.
type QuotaTopupBody struct {
	Tokens int64  `json:"tokens"`
	Method string `json:"method"`
}

func (dto QuotaTopupBody) Validate(v *validator.MapValidator) {
	v.Field("tokens").Required()
}
