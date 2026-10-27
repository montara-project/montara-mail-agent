package dtos

import "montara-mail-agent/server/internal/lib/validator"

// AgentBotBody creates or updates an organization's AI agent persona. The
// system prompt is composed from the four persona fields at runtime; there is
// no system prompt field to set.
type AgentBotBody struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Soul        string `json:"soul"`
	Memory      string `json:"memory"`
	Style       string `json:"style"`
	Instruction string `json:"instruction"`
	IsDefault   bool   `json:"is_default"`
}

func (dto AgentBotBody) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().MaxLen(100)
	v.Field("description").String().MaxLen(300)
	v.Field("soul").String().MaxLen(5000)
	v.Field("memory").String().MaxLen(5000)
	v.Field("style").String().MaxLen(5000)
	v.Field("instruction").String().MaxLen(5000)
}
