package dtos

import "montara-mail-agent/server/internal/lib/validator"

// AgentSkillBody creates or updates a custom skill: what it is called, what
// it tells the model to do with an email, and the agent bot that runs it.
type AgentSkillBody struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Instruction string `json:"instruction"`
	AgentBotID  string `json:"agent_bot_id"`
	IsEnabled   bool   `json:"is_enabled"`
}

func (dto AgentSkillBody) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().MaxLen(100)
	v.Field("description").String().MaxLen(300)
	v.Field("instruction").Required().String().MaxLen(5000)
	v.Field("agent_bot_id").Regex(optionalUUID)
}

// BuiltinSkillBody switches a built-in skill on or off and picks the agent
// bot that runs it (empty means the one the user has picked).
type BuiltinSkillBody struct {
	IsEnabled  bool   `json:"is_enabled"`
	AgentBotID string `json:"agent_bot_id"`
}

func (dto BuiltinSkillBody) Validate(v *validator.MapValidator) {
	v.Field("agent_bot_id").Regex(optionalUUID)
}

// RunSkillBody runs a skill on one mail: the bot the user has picked, used
// when the skill names none, and for draft_reply what the reply should say.
type RunSkillBody struct {
	AgentBotID  string `json:"agent_bot_id"`
	Instruction string `json:"instruction"`
}

func (dto RunSkillBody) Validate(v *validator.MapValidator) {
	v.Field("agent_bot_id").Regex(optionalUUID)
	v.Field("instruction").String().MaxLen(2000)
}
