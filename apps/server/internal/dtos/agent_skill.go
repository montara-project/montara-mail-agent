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
// when the skill names none, what a reply skill's reply should say, the
// reply draft a draft skill rewrites, the language a translation goes into
// (a BCP 47 tag, the browser's) and the tone of a translated reply.
type RunSkillBody struct {
	AgentBotID  string `json:"agent_bot_id"`
	Instruction string `json:"instruction"`
	Draft       string `json:"draft"`
	Language    string `json:"language"`
	Tone        string `json:"tone"`
}

func (dto RunSkillBody) Validate(v *validator.MapValidator) {
	v.Field("agent_bot_id").Regex(optionalUUID)
	v.Field("instruction").String().MaxLen(2000)
	v.Field("draft").String().MaxLen(20000)
	v.Field("language").Regex(`^$|^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$`)
	v.Field("tone").Regex(`^$|^(casual|professional|business)$`)
}
