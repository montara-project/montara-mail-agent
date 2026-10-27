package models

import (
	"strings"
	"testing"
)

// personaWords is the fixed clause of the opening sentence, one word per
// element so the expected text cannot drift from the production wording.
var personaWords = []string{"an", "AI", "assistant", "working", "on", "the", "mailbox", "owner's", "behalf"}

// personaOpening builds the sentence Persona must open with.
func personaOpening(name, description string) string {
	opening := "You are " + name + ", " + strings.Join(personaWords, " ")
	if description != "" {
		return opening + ": " + description + "."
	}
	return opening + "."
}

// Persona renders the persona block: a fixed opening sentence, then one
// section per non-empty field.
func TestPersona(t *testing.T) {
	tests := []struct {
		name string
		bot  AgentBot
	}{
		{
			name: "all fields set",
			bot: AgentBot{
				Name:        "Ops Bot",
				Description: "answers the ops inbox.",
				Soul:        "Calm and precise.",
				Memory:      "The team ships on Fridays.",
				Style:       "Short sentences.",
				Instruction: "Never promise a deadline.",
			},
		},
		{
			name: "blank sections omitted",
			bot: AgentBot{
				Name:        "Ops Bot",
				Description: "answers the ops inbox.",
				Soul:        "Calm and precise.",
				Memory:      "  \n\t ",
				Style:       "",
				Instruction: "Never promise a deadline.",
			},
		},
		{
			name: "name only",
			bot:  AgentBot{Name: "Solo"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.bot.Persona()

			opening := personaOpening(tt.bot.Name, tt.bot.Description)
			if !strings.HasPrefix(got, opening) {
				t.Fatalf("Persona() does not start with %q:\n%s", opening, got)
			}

			// Every field becomes "TITLE:\n" plus its trimmed text; an empty
			// or whitespace-only field contributes no section.
			kept := 0
			for _, section := range []struct{ title, body string }{
				{"SOUL", tt.bot.Soul},
				{"MEMORY", tt.bot.Memory},
				{"STYLE", tt.bot.Style},
				{"INSTRUCTIONS", tt.bot.Instruction},
			} {
				body := strings.TrimSpace(section.body)
				if body == "" {
					if strings.Contains(got, section.title+":") {
						t.Fatalf("Persona() has %q but the field is blank:\n%s", section.title, got)
					}
					continue
				}
				kept++
				if want := section.title + ":\n" + body; !strings.Contains(got, want) {
					t.Fatalf("Persona() misses %q:\n%s", want, got)
				}
			}

			if kept == 0 && got != opening {
				t.Fatalf("Persona() = %q, want exactly %q", got, opening)
			}
			if !strings.HasSuffix(got, ".") {
				t.Fatalf("Persona() does not end with a period:\n%s", got)
			}
		})
	}
}

// Every built-in skill is found by its key and keyed by it, and an unknown
// key finds nothing; a custom skill is keyed by its id.
func TestBuiltinSkills(t *testing.T) {
	keys := []string{SkillSummarize, SkillOrganize, SkillDraftReply, SkillHumanize, SkillCopyEdit,
		SkillProspectReply, SkillObjectionReply, SkillPressReply}
	if len(BuiltinSkills) != len(keys) {
		t.Fatalf("%d built-in skills, want %d", len(BuiltinSkills), len(keys))
	}
	for _, key := range keys {
		s, ok := BuiltinSkill(key)
		if !ok || s.Key() != key || s.Instruction == "" || !s.IsEnabled {
			t.Fatalf("BuiltinSkill(%q) = %+v, %v", key, s, ok)
		}
		// The skills table keeps built-in keys in a VARCHAR(32).
		if len(key) > 32 {
			t.Fatalf("built-in key %q is too long", key)
		}
	}
	// The draft skills rewrite the reply being written; the rest work on the email.
	for key, target := range map[string]string{SkillHumanize: SkillTargetDraft, SkillCopyEdit: SkillTargetDraft,
		SkillPressReply: SkillTargetEmail, SkillSummarize: SkillTargetEmail} {
		if s, _ := BuiltinSkill(key); s.WorksOn() != target {
			t.Fatalf("%s works on %q, want %q", key, s.WorksOn(), target)
		}
	}
	if _, ok := BuiltinSkill("nope"); ok {
		t.Fatal("BuiltinSkill found an unknown key")
	}
	custom := AgentSkill{Name: "Mine"}
	if custom.Key() != custom.ID.String() || custom.WorksOn() != SkillTargetEmail || custom.Answers() != SkillOutputText {
		t.Fatalf("custom skill = key %q, works on %q, answers %q", custom.Key(), custom.WorksOn(), custom.Answers())
	}
}
