package mailai

import (
	"context"
	"reflect"
	"strings"
	"testing"

	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

type fakeClient struct {
	answer string
	prompt string
}

func (f *fakeClient) Complete(_ context.Context, _, prompt string, _ int64) (string, error) {
	f.prompt = prompt
	return f.answer, nil
}

func TestClassify(t *testing.T) {
	mails := []models.Mail{
		{FromEmail: "boss@example.com", Subject: "Contract due Friday", Body: "Please sign."},
		{FromName: "Shop", FromEmail: "news@shop.example", Subject: "Sale", Body: "50% off"},
		{FromEmail: "x@example.com", Subject: "Skipped"},
	}
	// The model answers out of order, adds noise, and skips the third mail.
	client := &fakeClient{answer: "Here you go:\n2 low_priority\n1 important.\n7 important\nfoo"}

	got, err := Classify(context.Background(), client, mails)
	if err != nil {
		t.Fatal(err)
	}
	want := map[int]string{0: constant.ImportanceImportant, 1: constant.ImportanceLowPriority}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Classify = %v, want %v", got, want)
	}
	if !strings.Contains(client.prompt, `<email id="2">`) || !strings.Contains(client.prompt, "From: Shop <news@shop.example>") {
		t.Fatalf("prompt does not wrap each mail:\n%s", client.prompt)
	}
}

func TestParseSuggestions(t *testing.T) {
	got := parseSuggestions("1. \"Thanks, I'll sign today.\"\n\n- Can we move it to Monday?\n• I can't make it.\nOne more\n")
	want := []string{"Thanks, I'll sign today.", "Can we move it to Monday?", "I can't make it."}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("parseSuggestions = %q, want %q", got, want)
	}
	if got := parseSuggestions("  \n"); len(got) != 0 {
		t.Fatalf("empty answer gave %q", got)
	}
}

func TestClip(t *testing.T) {
	if got := clip("héllo", 2); got != "hé" {
		t.Fatalf("clip cut inside a rune: %q", got)
	}
}

// Without a bot the reply prompt is the built-in one; with one, the persona
// opens it and the format and untrusted-data rules still follow.
func TestReplySystem(t *testing.T) {
	if got := replySystem(nil); got != replyPrompt {
		t.Fatalf("replySystem(nil) changed the built-in prompt:\n%s", got)
	}
	if !strings.Contains(replySystem(nil), "You write short reply options") {
		t.Fatalf("built-in reply prompt lost its opening")
	}

	bot := &models.AgentBot{Name: "Ops Bot", Description: "answers the ops inbox."}
	got := replySystem(bot)
	persona := bot.Persona()

	if got != persona+"\n\n"+replyPrompt {
		t.Fatalf("replySystem(bot) is not persona + blank line + prompt:\n%s", got)
	}
	for _, want := range []string{bot.Name, "You write short reply options"} {
		if !strings.Contains(got, want) {
			t.Fatalf("replySystem(bot) misses %q:\n%s", want, got)
		}
	}
}
