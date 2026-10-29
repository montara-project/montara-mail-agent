package dtos

import "montara-mail-agent/server/internal/lib/validator"

// APIKeyBody creates an API key for the /mcp endpoint. A key always expires:
// ExpiresInDays defaults to 90, and a year is the most.
type APIKeyBody struct {
	Name          string `json:"name"`
	ExpiresInDays int    `json:"expires_in_days"`
}

func (dto APIKeyBody) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().MaxLen(100)
	v.Field("expires_in_days").IntRange(1, 365)
}
