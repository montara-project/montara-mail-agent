package dtos

import "montara-mail-agent/server/internal/lib/validator"

// QuotaTopupBody is a pay-as-you-go token purchase: the token count, priced
// Rp1.000 per 1M tokens and paid straight from the IDR wallet.
type QuotaTopupBody struct {
	Tokens int64 `json:"tokens"`
}

func (dto QuotaTopupBody) Validate(v *validator.MapValidator) {
	v.Field("tokens").Required()
}
