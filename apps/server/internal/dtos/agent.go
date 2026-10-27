package dtos

import "montara-mail-agent/server/internal/lib/validator"

// AgentConversationBody opens a conversation, optionally bound to one mailbox.
type AgentConversationBody struct {
	EmailAccountID string `json:"email_account_id"`
}

func (dto AgentConversationBody) Validate(v *validator.MapValidator) {
	v.Field("email_account_id").Regex(optionalUUID)
}

// AgentChatBody is one copilot turn: the prompt, the conversation it belongs
// to (a new one is opened when absent), the mailbox to bind a new
// conversation to, and the email the user is asking about, if any.
type AgentChatBody struct {
	ConversationID string `json:"conversation_id"`
	EmailAccountID string `json:"email_account_id"`
	MailID         string `json:"mail_id"`
	AgentBotID     string `json:"agent_bot_id"`
	Message        string `json:"message"`
}

func (dto AgentChatBody) Validate(v *validator.MapValidator) {
	v.Field("conversation_id").Regex(optionalUUID)
	v.Field("email_account_id").Regex(optionalUUID)
	v.Field("mail_id").Regex(optionalUUID)
	v.Field("agent_bot_id").Regex(optionalUUID)
	v.Field("message").Required().String().MaxLen(10000)
}

// AgentDraftsQuery lists an organization's draft queue, optionally by status.
type AgentDraftsQuery struct {
	ListQuery
	OrganizationID string `query:"organization_id"`
	Status         string `query:"status"`
}

func (dto AgentDraftsQuery) Validate(v *validator.MapValidator) {
	dto.base(v)
	v.Field("organization_id").Regex(optionalUUID)
	v.Field("status").Regex(`^(|pending|discarded|sent)$`)
}

// AgentConversationsQuery lists a user's conversations in one organization.
type AgentConversationsQuery struct {
	ListQuery
	OrganizationID string `query:"organization_id"`
}

func (dto AgentConversationsQuery) Validate(v *validator.MapValidator) {
	dto.base(v)
	v.Field("organization_id").Required().Regex(uuidPattern)
}

// uuidPattern is an object id as the routes see it; optionalUUID accepts the
// empty string too, for a body that leaves the field out entirely.
const (
	uuidPattern  = `^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`
	optionalUUID = `^$|` + uuidPattern
)
