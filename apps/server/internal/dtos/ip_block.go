package dtos

import "montara-mail-agent/server/internal/lib/validator"

// IPBlockBody blocks an address ("203.0.113.7") or a range
// ("203.0.113.0/24"). ExpiresInHours 0 blocks until someone removes it.
type IPBlockBody struct {
	Address        string `json:"address"`
	Reason         string `json:"reason"`
	ExpiresInHours int    `json:"expires_in_hours"`
}

func (dto IPBlockBody) Validate(v *validator.MapValidator) {
	v.Field("address").Required().String().MaxLen(64)
	v.Field("reason").String().MaxLen(300)
	v.Field("expires_in_hours").IntRange(0, 24*365)
}
