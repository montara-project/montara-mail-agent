package mailagent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/mailsync"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

// Tool names, as the model sees them.
const (
	toolSearch         = "search_mails"
	toolGet            = "get_mail"
	toolStats          = "mailbox_stats"
	toolMove           = "move_mail"
	toolFlags          = "set_flags"
	toolProposeReply   = "propose_reply"
	toolProposeForward = "propose_forward"
	toolProposeEmail   = "propose_email"
)

// Limits the mailbox-reading tools enforce, so one call can neither flood the
// context nor escape it.
const (
	searchLimit    = 25
	mailBodyLimit  = 20000
	recipientLimit = 20
)

// toolset carries what the tools act through, bound to one turn's mailbox.
type toolset struct {
	app  *app.Application
	sync *mailsync.Syncer
	s    Session
}

func newToolset(app *app.Application, sync *mailsync.Syncer, s Session) toolset {
	return toolset{app: app, sync: sync, s: s}
}

func (t *toolset) defs() []llm.ToolDef {
	return []llm.ToolDef{
		{
			Name:        toolSearch,
			Description: "Search the mailbox. Returns a page of emails matching the query, newest first, with id, sender, subject, date and a teaser.",
			Parameters: json.RawMessage(`{
				"type": "object",
				"properties": {
					"query": {"type": "string", "description": "Text matched against the sender and the subject; empty lists everything"},
					"folder": {"type": "string", "enum": ["inbox", "archive", "sent", "drafts", "spam", "trash"], "description": "The folder to search; inbox when omitted"},
					"unread_only": {"type": "boolean", "description": "Only unread emails"}
				}
			}`),
		},
		{
			Name:        toolGet,
			Description: "Read one email in full: sender, recipients, date, subject and body text.",
			Parameters: json.RawMessage(`{
				"type": "object",
				"properties": {
					"mail_id": {"type": "string", "description": "The email's id, from search_mails"}
				},
				"required": ["mail_id"]
			}`),
		},
		{
			Name:        toolStats,
			Description: "Counts of the organization's unread, spam and connected accounts.",
		},
		{
			Name:        toolMove,
			Description: "Move one email to another folder. Allowed on the user's behalf without asking.",
			Parameters: json.RawMessage(`{
				"type": "object",
				"properties": {
					"mail_id": {"type": "string"},
					"folder": {"type": "string", "enum": ["inbox", "archive", "spam", "trash"]}
				},
				"required": ["mail_id", "folder"]
			}`),
		},
		{
			Name:        toolFlags,
			Description: "Mark one email read or unread, and star or unstar it.",
			Parameters: json.RawMessage(`{
				"type": "object",
				"properties": {
					"mail_id": {"type": "string"},
					"is_read": {"type": "boolean"},
					"is_starred": {"type": "boolean"}
				},
				"required": ["mail_id"]
			}`),
		},
		{
			Name:        toolProposeReply,
			Description: "Propose a reply to one email for the user to approve. Nothing is sent until the user approves the proposal. Write the body ready to send, in the email's language.",
			Parameters: json.RawMessage(`{
				"type": "object",
				"properties": {
					"mail_id": {"type": "string"},
					"to": {"type": "array", "items": {"type": "string"}, "description": "Recipients; the email's sender when omitted"},
					"cc": {"type": "array", "items": {"type": "string"}},
					"subject": {"type": "string", "description": "Defaults to the email's subject with a Re: prefix"},
					"text": {"type": "string", "description": "The reply, as plain text"}
				},
				"required": ["mail_id", "text"]
			}`),
		},
		{
			Name:        toolProposeForward,
			Description: "Propose forwarding one email to other addresses for the user to approve. Nothing is sent until the user approves the proposal.",
			Parameters: json.RawMessage(`{
				"type": "object",
				"properties": {
					"mail_id": {"type": "string"},
					"to": {"type": "array", "items": {"type": "string"}},
					"note": {"type": "string", "description": "A short note on top of the forwarded email"}
				},
				"required": ["mail_id", "to"]
			}`),
		},
		{
			Name:        toolProposeEmail,
			Description: "Propose a new email from this mailbox for the user to approve. Nothing is sent until the user approves the proposal.",
			Parameters: json.RawMessage(`{
				"type": "object",
				"properties": {
					"to": {"type": "array", "items": {"type": "string"}},
					"cc": {"type": "array", "items": {"type": "string"}},
					"subject": {"type": "string"},
					"text": {"type": "string"}
				},
				"required": ["to", "subject", "text"]
			}`),
		},
	}
}

// execute runs one tool call, answering (content, payload): content goes back
// to the model, payload is the row the client may render. A failed call is a
// tool result saying so, not a broken turn.
func (t *toolset) execute(ctx context.Context, call llm.ToolCall) (string, json.RawMessage) {
	var args struct {
		Query      string   `json:"query"`
		Folder     string   `json:"folder"`
		UnreadOnly bool     `json:"unread_only"`
		MailID     string   `json:"mail_id"`
		IsRead     *bool    `json:"is_read"`
		IsStarred  *bool    `json:"is_starred"`
		To         []string `json:"to"`
		Cc         []string `json:"cc"`
		Subject    string   `json:"subject"`
		Text       string   `json:"text"`
		Note       string   `json:"note"`
	}
	// An unparsable argument list is the model's mistake to recover from; the
	// empty args then fail the required-field checks below.
	_ = json.Unmarshal(call.Args, &args)

	switch call.Name {
	case toolSearch:
		return t.search(ctx, args.Query, args.Folder, args.UnreadOnly)
	case toolGet:
		return t.getMail(ctx, args.MailID)
	case toolStats:
		return t.stats(ctx)
	case toolMove:
		return t.move(ctx, args.MailID, args.Folder)
	case toolFlags:
		return t.flags(ctx, args.MailID, args.IsRead, args.IsStarred)
	case toolProposeReply:
		return t.proposeReply(ctx, args.MailID, args.To, args.Cc, args.Subject, args.Text)
	case toolProposeForward:
		return t.proposeForward(ctx, args.MailID, args.To, args.Note)
	case toolProposeEmail:
		return t.proposeEmail(ctx, args.To, args.Cc, args.Subject, args.Text)
	}
	return fmt.Sprintf("unknown tool %q", call.Name), nil
}

// search lists one folder page. The model's folder word is trusted only as
// far as the constants go.
func (t *toolset) search(ctx context.Context, query, folder string, unreadOnly bool) (string, json.RawMessage) {
	if folder == "" {
		folder = constant.FolderInbox
	}
	if !isKnownFolder(folder) {
		return fmt.Sprintf("no such folder %q", folder), nil
	}

	mails, err := t.app.Repositories.Mail.List(ctx, t.s.Account.ID, repositories.MailListParams{
		ListParams: repositories.ListParams{Offset: 0, Limit: searchLimit, Search: query},
		Folder:     folder,
		Unread:     unreadOnly,
	})
	if err != nil {
		return "the mailbox could not be searched: " + err.Error(), nil
	}

	type hit struct {
		ID         string `json:"id"`
		From       string `json:"from"`
		Subject    string `json:"subject"`
		ReceivedAt string `json:"received_at"`
		Unread     bool   `json:"unread"`
		Teaser     string `json:"teaser"`
	}
	out := make([]hit, 0, len(mails))
	for _, m := range mails {
		out = append(out, hit{
			ID:         m.ID.String(),
			From:       mailAddress(m.FromName, m.FromEmail),
			Subject:    m.Subject,
			ReceivedAt: m.ReceivedAt.Format(time.RFC3339),
			Unread:     !m.IsRead,
			Teaser:     m.Teaser,
		})
	}
	payload, err := json.Marshal(out)
	if err != nil {
		return "the search result could not be rendered", nil
	}
	return string(payload), payload
}

// getMail reads one mail in full, wrapped so its content stays data.
func (t *toolset) getMail(ctx context.Context, mailID string) (string, json.RawMessage) {
	m, ok := t.mailOf(ctx, mailID)
	if !ok {
		return "no such email in this mailbox", nil
	}

	wrapped := fmt.Sprintf("<email id=%q>\nFrom: %s\nTo: %s\nDate: %s\nSubject: %s\n\n%s\n</email>",
		m.ID, mailAddress(m.FromName, m.FromEmail), mailAddresses(m.To),
		m.ReceivedAt.Format(time.RFC3339), m.Subject, clip(m.Body, mailBodyLimit))
	return wrapped, nil
}

func (t *toolset) stats(ctx context.Context) (string, json.RawMessage) {
	stats, err := t.app.Repositories.EmailAccount.Stats(ctx, t.s.Conversation.OrganizationID)
	if err != nil {
		return "the mailbox statistics could not be read: " + err.Error(), nil
	}
	payload, err := json.Marshal(stats)
	if err != nil {
		return "the statistics could not be rendered", nil
	}
	return string(payload), payload
}

// move acts on the user's behalf: folders the model may pick are the app's
// own move targets, and the mail must live in the bound account.
func (t *toolset) move(ctx context.Context, mailID, folder string) (string, json.RawMessage) {
	if !isMoveTarget(folder) {
		return fmt.Sprintf("emails cannot be moved to %q", folder), nil
	}
	m, ok := t.mailOf(ctx, mailID)
	if !ok {
		return "no such email in this mailbox", nil
	}
	if err := t.sync.Move(ctx, t.s.Account, m, folder); err != nil {
		return "the email could not be moved: " + err.Error(), nil
	}
	return fmt.Sprintf("moved %q to %s", m.Subject, folder), nil
}

func (t *toolset) flags(ctx context.Context, mailID string, isRead, isStarred *bool) (string, json.RawMessage) {
	if isRead == nil && isStarred == nil {
		return "nothing to change: give is_read or is_starred", nil
	}
	m, ok := t.mailOf(ctx, mailID)
	if !ok {
		return "no such email in this mailbox", nil
	}
	if err := t.app.Repositories.Mail.Patch(ctx, m.ID, repositories.MailPatch{IsRead: isRead, IsStarred: isStarred}); err != nil {
		return "the email's flags could not be saved: " + err.Error(), nil
	}
	// The mail server learns the flags in the background, like the app's own
	// PATCH route does; a failure there only costs the next sync's view.
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), time.Minute)
		defer cancel()
		if err := t.sync.SetFlags(bgCtx, t.s.Account, m, isRead, isStarred); err != nil {
			t.app.Logger.Warn("agent flag sync failed", "mail", m.ID, "error", err)
		}
	}()
	return fmt.Sprintf("updated %q", m.Subject), nil
}

// proposeReply stores a reply proposal, defaulting the recipients and subject
// from the mail being answered.
func (t *toolset) proposeReply(ctx context.Context, mailID string, to, cc []string, subject, text string) (string, json.RawMessage) {
	m, ok := t.mailOf(ctx, mailID)
	if !ok {
		return "no such email in this mailbox", nil
	}
	if len(to) == 0 {
		if m.FromEmail == "" {
			return "this email has no sender to reply to", nil
		}
		to = []string{m.FromEmail}
	}
	if subject == "" {
		subject = "Re: " + m.Subject
	}
	return t.propose(ctx, models.AgentActionReply, &m, to, cc, subject, text)
}

func (t *toolset) proposeForward(ctx context.Context, mailID string, to []string, note string) (string, json.RawMessage) {
	m, ok := t.mailOf(ctx, mailID)
	if !ok {
		return "no such email in this mailbox", nil
	}
	if len(to) == 0 {
		return "a forward needs at least one recipient", nil
	}
	return t.propose(ctx, models.AgentActionFwd, &m, to, nil, m.Subject, note)
}

func (t *toolset) proposeEmail(ctx context.Context, to, cc []string, subject, text string) (string, json.RawMessage) {
	if len(to) == 0 || subject == "" || text == "" {
		return "a new email needs to, subject and text", nil
	}
	return t.propose(ctx, models.AgentActionSend, nil, to, cc, subject, text)
}

// propose validates the recipients and stores the pending action.
func (t *toolset) propose(ctx context.Context, kind string, m *models.Mail, to, cc []string, subject, text string) (string, json.RawMessage) {
	if len(to) > recipientLimit || len(cc) > recipientLimit {
		return fmt.Sprintf("a mail goes to at most %d addresses", recipientLimit), nil
	}
	if strings.TrimSpace(text) == "" {
		return "the mail's text is empty", nil
	}

	payload := map[string]any{"to": to, "cc": cc, "subject": subject, "text": text}
	if m != nil {
		payload["mail_id"] = m.ID
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "the proposal could not be rendered", nil
	}

	action := models.AgentAction{
		ConversationID: t.s.Conversation.ID,
		OrganizationID: t.s.Conversation.OrganizationID,
		UserID:         t.s.Conversation.UserID,
		Kind:           kind,
		Payload:        raw,
		Status:         models.AgentActionPending,
	}
	if err := t.app.Repositories.Agent.InsertAction(ctx, &action); err != nil {
		return "the proposal could not be saved: " + err.Error(), nil
	}

	out, err := json.Marshal(action)
	if err != nil {
		return "the proposal could not be rendered", nil
	}
	return fmt.Sprintf("proposed; waiting for the user's approval of action %s", action.ID), out
}

// mailOf loads one mail, only from the bound account.
func (t *toolset) mailOf(ctx context.Context, mailID string) (models.Mail, bool) {
	id, err := uuid.Parse(mailID)
	if err != nil {
		return models.Mail{}, false
	}
	m, err := t.app.Repositories.Mail.Get(ctx, id)
	if err != nil || m.EmailAccountID != t.s.Account.ID {
		return models.Mail{}, false
	}
	return m, true
}

func isKnownFolder(folder string) bool {
	for _, f := range constant.Folders {
		if f == folder {
			return true
		}
	}
	return false
}

func isMoveTarget(folder string) bool {
	for _, f := range constant.MoveTargets {
		if f == folder {
			return true
		}
	}
	return false
}

// clip cuts s to at most limit runes, on a word boundary where possible.
func clip(s string, limit int) string {
	runes := []rune(s)
	if len(runes) <= limit {
		return s
	}
	cut := string(runes[:limit])
	if i := strings.LastIndexAny(cut, " \n"); i > limit/2 {
		cut = cut[:i]
	}
	return cut + " …"
}

func mailAddress(name, email string) string {
	if name == "" {
		return email
	}
	return name + " <" + email + ">"
}

func mailAddresses(contacts []models.MailContact) string {
	out := ""
	for i, c := range contacts {
		if i > 0 {
			out += ", "
		}
		out += mailAddress(c.Name, c.Email)
	}
	return out
}
