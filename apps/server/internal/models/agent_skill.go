package models

import "github.com/google/uuid"

// The built-in skills, by key.
const (
	SkillSummarize  = "summarize"
	SkillOrganize   = "organize"
	SkillDraftReply = "draft_reply"
)

// AgentSkill is a task the AI agent runs on mail, from the reader's Skills
// menu or as a /command in the assistant chat. A built-in skill (Builtin set)
// takes its name and instruction from BuiltinSkills; its row only keeps the
// organization's switch and agent bot (see migration 0011). A custom skill
// carries its own.
type AgentSkill struct {
	Base
	SoftDelete
	OrganizationID uuid.UUID  `db:"organization_id" json:"organization_id"`
	Builtin        *string    `db:"builtin" json:"builtin"`
	Name           string     `db:"name" json:"name"`
	Description    string     `db:"description" json:"description"`
	Instruction    string     `db:"instruction" json:"instruction"`
	AgentBotID     *uuid.UUID `db:"agent_bot_id" json:"agent_bot_id"`
	IsEnabled      bool       `db:"is_enabled" json:"is_enabled"`
}

// Key names the skill in URLs and chat turns: the built-in key, or the
// custom skill's id.
func (s AgentSkill) Key() string {
	if s.Builtin != nil {
		return *s.Builtin
	}
	return s.ID.String()
}

func builtin(key, name, description, instruction string) AgentSkill {
	return AgentSkill{Builtin: &key, Name: name, Description: description, Instruction: instruction, IsEnabled: true}
}

// BuiltinSkills are the skills every organization has, in the order the app
// lists them. Instruction is what the assistant chat follows when the skill
// is invoked there; the reader's Skills menu runs each one directly.
var BuiltinSkills = []AgentSkill{
	builtin(SkillSummarize, "Summarize email",
		"A short summary: the gist, the key facts and what the email asks of you.",
		"Summarize the email or thread the user means (read it with get_mail first; by default the attached email). "+
			"Start with a one-sentence TL;DR in bold, then 2 to 4 bullets with the key names, dates, amounts and deadlines in bold. "+
			"End with an \"Action items\" list when it asks something of the user."),
	builtin(SkillOrganize, "Organize",
		"Sorts mail into important, low priority and broadcast (newsletters, announcements).",
		"Sort the emails the user means (by default the unread inbox mail, found with search_mails) into important, "+
			"low_priority and broadcast: one message sent to many people, such as newsletters, announcements and campaigns. "+
			"Label each one with set_importance, then answer with one short list per group, naming each email by sender and subject. "+
			"Do not move or archive mail unless the user asks."),
	builtin(SkillDraftReply, "Draft / reply email",
		"Writes a full reply in the agent bot's voice, for you to review before it is sent.",
		"Draft a reply to the email the user means (by default the attached email; read it with get_mail first), "+
			"written in your persona's voice and style, then propose it with propose_reply so the user can approve it. "+
			"Follow what the user says the reply should say; ask only when the email leaves the answer truly open."),
}

// BuiltinSkill returns the built-in skill with key, if there is one.
func BuiltinSkill(key string) (AgentSkill, bool) {
	for _, s := range BuiltinSkills {
		if *s.Builtin == key {
			return s, true
		}
	}
	return AgentSkill{}, false
}
