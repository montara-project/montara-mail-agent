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

// DraftReplyBody asks for a whole reply: what it should say or how it should
// sound (empty means a sensible reply), and the persona that writes it.
type DraftReplyBody struct {
	Instruction string `json:"instruction"`
	AgentBotID  string `json:"agent_bot_id"`
}

func (dto DraftReplyBody) Validate(v *validator.MapValidator) {
	v.Field("instruction").String().MaxLen(2000)
	v.Field("agent_bot_id").Regex(optionalUUID)
}
