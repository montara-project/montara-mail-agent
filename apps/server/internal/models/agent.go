package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AgentConversation is one chat with the mail copilot, scoped to an
// organization (and optionally to one mailbox) and owned by the user who
// started it (see migration 0010).
type AgentConversation struct {
	Base
	OrganizationID uuid.UUID  `db:"organization_id" json:"organization_id"`
	UserID         uuid.UUID  `db:"user_id" json:"user_id"`
	EmailAccountID *uuid.UUID `db:"email_account_id" json:"email_account_id,omitempty"`
	Title          string     `db:"title" json:"title"`
}

// Agent message roles: the user's prompt, the model's answer, and a tool
// row that carries what a call returned.
const (
	AgentRoleUser      = "user"
	AgentRoleAssistant = "assistant"
	AgentRoleTool      = "tool"
)

// AgentMessage is one row of a conversation. An assistant row may name the
// tool it asked to run (ToolName + ToolPayload holding the call arguments); a
// tool row's ToolPayload carries what the call returned.
type AgentMessage struct {
	ID             uuid.UUID       `db:"id" json:"id"`
	CreatedAt      time.Time       `db:"created_at" json:"created_at"`
	ConversationID uuid.UUID       `db:"conversation_id" json:"conversation_id"`
	Role           string          `db:"role" json:"role"`
	Content        string          `db:"content" json:"content"`
	ToolName       string          `db:"tool_name" json:"tool_name,omitempty"`
	ToolPayload    json.RawMessage `db:"tool_payload" json:"tool_payload,omitempty"`
	TokensIn       int             `db:"tokens_in" json:"tokens_in"`
	TokensOut      int             `db:"tokens_out" json:"tokens_out"`
}

// Agent action kinds: the only mail the agent can send out, and only after an
// explicit approval.
const (
	AgentActionReply = "send_reply"
	AgentActionSend  = "send_email"
	AgentActionFwd   = "forward"
)

// Agent action statuses: an approved row was green-lit; done means the mail
// server took it, failed that it didn't.
const (
	AgentActionPending  = "pending"
	AgentActionApproved = "approved"
	AgentActionDenied   = "denied"
	AgentActionDone     = "done"
	AgentActionFailed   = "failed"
)

// AgentAction is one proposed outbound mail waiting for (or past) the user's
// decision. Payload's shape follows Kind: reply carries mail_id, to, cc,
// subject, text, html.
type AgentAction struct {
	Base
	ConversationID uuid.UUID       `db:"conversation_id" json:"conversation_id"`
	OrganizationID uuid.UUID       `db:"organization_id" json:"organization_id"`
	UserID         uuid.UUID       `db:"user_id" json:"user_id"`
	Kind           string          `db:"kind" json:"kind"`
	Payload        json.RawMessage `db:"payload" json:"payload"`
	Status         string          `db:"status" json:"status"`
	Error          string          `db:"error" json:"error,omitempty"`
}

// Agent draft statuses.
const (
	AgentDraftPending   = "pending"
	AgentDraftDiscarded = "discarded"
	AgentDraftSent      = "sent"
)

// AgentDraft is a reply the background automation drafted for a mail, waiting
// for review in the drafts queue. AgentBotID names the persona that drafted
// it, when the organization had a default bot; null means the built-in one.
type AgentDraft struct {
	Base
	OrganizationID uuid.UUID  `db:"organization_id" json:"organization_id"`
	EmailAccountID uuid.UUID  `db:"email_account_id" json:"email_account_id"`
	MailID         *uuid.UUID `db:"mail_id" json:"mail_id,omitempty"`
	AgentBotID     *uuid.UUID `db:"agent_bot_id" json:"agent_bot_id,omitempty"`
	To             []string   `db:"-" json:"to"`
	Cc             []string   `db:"-" json:"cc,omitempty"`
	Subject        string     `db:"subject" json:"subject"`
	Text           string     `db:"text" json:"text"`
	HTML           string     `db:"html" json:"html,omitempty"`
	Status         string     `db:"status" json:"status"`
	DecidedBy      *uuid.UUID `db:"decided_by" json:"decided_by,omitempty"`
}
