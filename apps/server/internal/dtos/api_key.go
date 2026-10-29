package dtos

import "montara-mail-agent/server/internal/lib/validator"

// APIKeyBody creates an API key for the /mcp endpoint. A key always expires:
// ExpiresInDays defaults to 90, and a year is the most. OrganizationID scopes
// the key to one organization; empty is global, every organization its owner
// reaches.
type APIKeyBody struct {
	Name           string `json:"name"`
	ExpiresInDays  int    `json:"expires_in_days"`
	OrganizationID string `json:"organization_id"`
}

func (dto APIKeyBody) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().MaxLen(100)
	v.Field("expires_in_days").IntRange(1, 365)
	v.Field("organization_id").Regex(optionalUUID)
}
