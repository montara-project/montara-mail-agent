package models

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// AgentBot is a user-defined persona for the AI agent: who it is (SOUL), what
// it should remember (MEMORY), how it writes (STYLE) and what it must or must
// not do (INSTRUCTION). The system prompt is composed from these at runtime;
// at most one live bot per organization is the default the auto-drafter uses
// (see migration 0010).
type AgentBot struct {
	Base
	SoftDelete
	OrganizationID uuid.UUID `db:"organization_id" json:"organization_id"`
	Name           string    `db:"name" json:"name"`
	Description    string    `db:"description" json:"description"`
	Soul           string    `db:"soul" json:"soul"`
	Memory         string    `db:"memory" json:"memory"`
	Style          string    `db:"style" json:"style"`
	Instruction    string    `db:"instruction" json:"instruction"`
	IsDefault      bool      `db:"is_default" json:"is_default"`
}

// Persona renders the bot's fields into the persona block that starts every
// agent prompt steered by this bot. This is the single place the persona is
// composed — the copilot prompt, the reply suggestions, the auto-drafter and
// the API's system_prompt preview all read it — so the preview the web form
// shows is what the model actually gets (the web mirrors it in
// apps/web-ui/src/lib/api/agent/bot-prompt.ts; change both together).
func (b AgentBot) Persona() string {
	var w strings.Builder
	w.WriteString(fmt.Sprintf("You are %s, an AI assistant working on the mailbox owner's behalf", b.Name))
	if b.Description != "" {
		w.WriteString(": " + b.Description)
	}
	w.WriteString(".")
	for _, section := range [...]struct{ title, body string }{
		{"SOUL", b.Soul},
		{"MEMORY", b.Memory},
		{"STYLE", b.Style},
		{"INSTRUCTIONS", b.Instruction},
	} {
		if strings.TrimSpace(section.body) == "" {
			continue
		}
		w.WriteString("\n\n" + section.title + ":\n" + strings.TrimSpace(section.body))
	}
	return w.String()
}
