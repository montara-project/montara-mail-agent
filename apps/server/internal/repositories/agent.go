package repositories

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// nullString maps an empty string to SQL NULL.
func nullString(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// nullUUID maps the zero UUID to SQL NULL.
func nullUUID(id uuid.UUID) any {
	if id == uuid.Nil {
		return nil
	}
	return id
}

// AgentRepository manages the copilot's data: conversations and their
// messages, the outbound actions waiting for approval, and the background
// automation's drafts (see migration 0010).
type AgentRepository struct {
	BaseRepository
}

const agentConversationColumns = `id, created_at, updated_at, organization_id, user_id, email_account_id, title`

func scanAgentConversation(row rowScanner) (models.AgentConversation, error) {
	var c models.AgentConversation
	err := row.Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt, &c.OrganizationID, &c.UserID, &c.EmailAccountID, &c.Title)
	return c, translateNotFound("agent_conversations", err)
}

// CreateConversation stores a new conversation, returning it with its
// timestamps re-read.
func (r *AgentRepository) CreateConversation(ctx context.Context, c *models.AgentConversation) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	c.ID = id
	if _, err := r.execContext(ctx, `
		INSERT INTO agent_conversations (id, organization_id, user_id, email_account_id, title)
		VALUES ($1, $2, $3, $4, $5)`,
		c.ID, c.OrganizationID, c.UserID, c.EmailAccountID, c.Title,
	); err != nil {
		return err
	}
	read, err := r.Conversation(ctx, c.ID)
	if err != nil {
		return err
	}
	*c = read
	return nil
}

// Conversation returns one conversation by id.
func (r *AgentRepository) Conversation(ctx context.Context, id uuid.UUID) (models.AgentConversation, error) {
	query := `SELECT ` + agentConversationColumns + ` FROM agent_conversations WHERE id = $1`
	return scanAgentConversation(r.queryRowContext(ctx, query, id))
}

// Conversations lists a user's conversations in an organization, most recent
// first.
func (r *AgentRepository) Conversations(ctx context.Context, orgID, userID uuid.UUID, limit int) ([]models.AgentConversation, error) {
	rows, err := r.queryContext(ctx, `
		SELECT `+agentConversationColumns+` FROM agent_conversations
		WHERE organization_id = $1 AND user_id = $2
		ORDER BY updated_at DESC LIMIT $3`,
		orgID, userID, limit,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanAgentConversation)
}

// RenameConversation sets the title a conversation carries.
func (r *AgentRepository) RenameConversation(ctx context.Context, id uuid.UUID, title string) error {
	res, err := r.execContext(ctx, `
		UPDATE agent_conversations SET title = $2, updated_at = now() WHERE id = $1`, id, title)
	if err != nil {
		return err
	}
	return requireAffected(res, "conversation")
}

// DeleteConversation removes a conversation and, through the foreign keys,
// its messages and actions.
func (r *AgentRepository) DeleteConversation(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM agent_conversations WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "conversation")
}

func scanAgentMessage(row rowScanner) (models.AgentMessage, error) {
	var m models.AgentMessage
	var payload []byte
	var toolName sql.NullString
	err := row.Scan(&m.ID, &m.CreatedAt, &m.ConversationID, &m.Role, &m.Content,
		&toolName, &payload, &m.TokensIn, &m.TokensOut)
	if err != nil {
		return m, translateNotFound("agent_messages", err)
	}
	m.ToolName = toolName.String
	if len(payload) > 0 {
		m.ToolPayload = payload
	}
	return m, nil
}

// InsertMessage stores one conversation row.
func (r *AgentRepository) InsertMessage(ctx context.Context, m *models.AgentMessage) error {
	if m.ID == uuid.Nil {
		id, err := uuid.NewV7()
		if err != nil {
			return err
		}
		m.ID = id
	}
	_, err := r.execContext(ctx, `
		INSERT INTO agent_messages (id, conversation_id, role, content, tool_name, tool_payload, tokens_in, tokens_out)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		m.ID, m.ConversationID, m.Role, m.Content, nullString(m.ToolName), []byte(m.ToolPayload), m.TokensIn, m.TokensOut,
	)
	return err
}

// Messages returns a conversation's rows, oldest first, capped at the most
// recent limit.
func (r *AgentRepository) Messages(ctx context.Context, conversationID uuid.UUID, limit int) ([]models.AgentMessage, error) {
	rows, err := r.queryContext(ctx, `
		SELECT id, created_at, conversation_id, role, content, tool_name, tool_payload, tokens_in, tokens_out
		FROM (SELECT * FROM agent_messages WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2) recent
		ORDER BY created_at, id`,
		conversationID, limit,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanAgentMessage)
}

func scanAgentAction(row rowScanner) (models.AgentAction, error) {
	var a models.AgentAction
	var payload []byte
	var failure sql.NullString
	err := row.Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt, &a.ConversationID, &a.OrganizationID,
		&a.UserID, &a.Kind, &payload, &a.Status, &failure)
	if err != nil {
		return a, translateNotFound("agent_actions", err)
	}
	a.Error = failure.String
	a.Payload = payload
	return a, nil
}

// InsertAction stores a proposed outbound mail in the pending state.
func (r *AgentRepository) InsertAction(ctx context.Context, a *models.AgentAction) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	a.ID = id
	_, err = r.execContext(ctx, `
		INSERT INTO agent_actions (id, conversation_id, organization_id, user_id, kind, payload, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		a.ID, a.ConversationID, a.OrganizationID, a.UserID, a.Kind, []byte(a.Payload), models.AgentActionPending,
	)
	return err
}

// Action returns one action by id.
func (r *AgentRepository) Action(ctx context.Context, id uuid.UUID) (models.AgentAction, error) {
	query := `SELECT id, created_at, updated_at, conversation_id, organization_id, user_id, kind, payload, status, error
		FROM agent_actions WHERE id = $1`
	return scanAgentAction(r.queryRowContext(ctx, query, id))
}

// SetActionStatus moves an action along its lifecycle, recording why a failed
// one failed.
func (r *AgentRepository) SetActionStatus(ctx context.Context, id uuid.UUID, status, errorMsg string) error {
	res, err := r.execContext(ctx, `
		UPDATE agent_actions SET status = $2, error = NULLIF($3, ''), updated_at = now() WHERE id = $1`,
		id, status, errorMsg,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "agent action")
}

// ActionsOf lists a conversation's actions, newest first.
func (r *AgentRepository) ActionsOf(ctx context.Context, conversationID uuid.UUID, limit int) ([]models.AgentAction, error) {
	rows, err := r.queryContext(ctx, `
		SELECT id, created_at, updated_at, conversation_id, organization_id, user_id, kind, payload, status, error
		FROM agent_actions WHERE conversation_id = $1
		ORDER BY created_at DESC LIMIT $2`,
		conversationID, limit,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanAgentAction)
}

const agentDraftColumns = `id, created_at, updated_at, organization_id, email_account_id, mail_id, "to", cc, subject, text, html, status, decided_by`

func scanAgentDraft(row rowScanner) (models.AgentDraft, error) {
	var d models.AgentDraft
	var to, cc []byte
	var html sql.NullString
	err := row.Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt, &d.OrganizationID, &d.EmailAccountID,
		&d.MailID, &to, &cc, &d.Subject, &d.Text, &html, &d.Status, &d.DecidedBy)
	if err != nil {
		return d, translateNotFound("agent_drafts", err)
	}
	if err := json.Unmarshal(to, &d.To); err != nil {
		return d, err
	}
	if len(cc) > 0 {
		if err := json.Unmarshal(cc, &d.Cc); err != nil {
			return d, err
		}
	}
	d.HTML = html.String
	return d, nil
}

// InsertDraft queues a drafted reply for review.
func (r *AgentRepository) InsertDraft(ctx context.Context, d *models.AgentDraft) error {
	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	d.ID = id
	to, err := json.Marshal(d.To)
	if err != nil {
		return err
	}
	cc, err := json.Marshal(d.Cc)
	if err != nil {
		return err
	}
	_, err = r.execContext(ctx, `
		INSERT INTO agent_drafts (id, organization_id, email_account_id, mail_id, "to", cc, subject, text, html, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		d.ID, d.OrganizationID, d.EmailAccountID, d.MailID, to, cc, d.Subject, d.Text, nullString(d.HTML), models.AgentDraftPending,
	)
	return err
}

// Draft returns one draft by id.
func (r *AgentRepository) Draft(ctx context.Context, id uuid.UUID) (models.AgentDraft, error) {
	query := `SELECT ` + agentDraftColumns + ` FROM agent_drafts WHERE id = $1`
	return scanAgentDraft(r.queryRowContext(ctx, query, id))
}

// Drafts lists an organization's queue, most recent first, optionally filtered
// to one status (empty means every status).
func (r *AgentRepository) Drafts(ctx context.Context, orgID uuid.UUID, status string, limit int) ([]models.AgentDraft, error) {
	query := `SELECT ` + agentDraftColumns + ` FROM agent_drafts
		WHERE organization_id = $1 AND ($2 = '' OR status = $2)
		ORDER BY created_at DESC LIMIT $3`
	rows, err := r.queryContext(ctx, query, orgID, status, limit)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanAgentDraft)
}

// SetDraftStatus moves a draft along its lifecycle, recording who decided.
func (r *AgentRepository) SetDraftStatus(ctx context.Context, id uuid.UUID, status string, decidedBy uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE agent_drafts SET status = $2, decided_by = $3, updated_at = now() WHERE id = $1`,
		id, status, nullUUID(decidedBy),
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "agent draft")
}

// HasDraftForMail reports whether a mail already has a draft in any state,
// so the automation never proposes the same reply twice — a sent draft means
// the mail is answered, a pending one is waiting, a discarded one was
// already refused once.
func (r *AgentRepository) HasDraftForMail(ctx context.Context, mailID uuid.UUID) (bool, error) {
	var found bool
	err := r.queryRowContext(ctx, `
		SELECT EXISTS (SELECT 1 FROM agent_drafts WHERE mail_id = $1)`,
		mailID,
	).Scan(&found)
	return found, err
}

// CountDraftsCreatedSince counts the drafts an organization queued since a
// point in time, for the automation's daily cap.
func (r *AgentRepository) CountDraftsCreatedSince(ctx context.Context, orgID uuid.UUID, since time.Time) (int64, error) {
	var n int64
	err := r.queryRowContext(ctx, `
		SELECT COUNT(*) FROM agent_drafts WHERE organization_id = $1 AND created_at >= $2`,
		orgID, since,
	).Scan(&n)
	return n, err
}
