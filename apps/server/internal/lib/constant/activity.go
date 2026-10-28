package constant

// Actions recorded in activity_logs (see migration 000009). The verb before
// the dot is the area, the noun after it the event.
const (
	ActivityAuthSignIn              = "auth.sign_in"
	ActivityProfileUpdated          = "profile.updated"
	ActivityPasswordChanged         = "password.changed"
	ActivityOrganizationCreated     = "organization.created"
	ActivityOrganizationUpdated     = "organization.updated"
	ActivityOrganizationDeleted     = "organization.deleted"
	ActivityOrganizationRestored    = "organization.restored"
	ActivityOrganizationPurged      = "organization.purged"
	ActivityEmailAccountConnected   = "email_account.connected"
	ActivityEmailAccountDisonnected = "email_account.disconnected"
	ActivityMailSent                = "mail.sent"
	ActivityMailReplied             = "mail.replied"
	ActivityMailForwarded           = "mail.forwarded"
	ActivityMailDeleted             = "mail.deleted"
	ActivityAgentBotCreated         = "agent_bot.created"
	ActivityAgentBotUpdated         = "agent_bot.updated"
	ActivityAgentBotDeleted         = "agent_bot.deleted"
	ActivitySkillCreated            = "skill.created"
	ActivitySkillUpdated            = "skill.updated"
	ActivitySkillDeleted            = "skill.deleted"
	ActivityMCPServerAdded          = "mcp_server.added"
	ActivityMCPServerUpdated        = "mcp_server.updated"
	ActivityMCPServerRemoved        = "mcp_server.removed"
)
