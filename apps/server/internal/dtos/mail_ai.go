package dtos

import "montara-mail-agent/server/internal/lib/validator"

// ReplySuggestionsBody is the optional body of the reply-suggestions route:
// which agent bot's persona should write the suggestions (empty or absent
// means the built-in one).
type ReplySuggestionsBody struct {
	AgentBotID string `json:"agent_bot_id"`
}

func (dto ReplySuggestionsBody) Validate(v *validator.MapValidator) {
	v.Field("agent_bot_id").Regex(optionalUUID)
}
