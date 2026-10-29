package handlers

import (
	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/mailagent"
	"montara-mail-agent/server/internal/mailsync"
)

type Handlers struct {
	Health       *healthHandler
	Organization *organizationHandler
	EmailAccount *emailAccountHandler
	Mail         *mailHandler
	LLMProvider  *llmProviderHandler
	Profile      *profileHandler
	ActivityLog  *activityLogHandler
	Agent        *agentHandler
	AgentBot     *agentBotHandler
	AgentSkill   *agentSkillHandler
	MCPServer    *mcpServerHandler
	APIKey       *apiKeyHandler
	MCP          *mcpEndpointHandler
	IPBlock      *ipBlockHandler
}

func New(app *app.Application) *Handlers {
	sync := mailsync.New(app)
	return &Handlers{
		Health:       &healthHandler{app: app},
		Organization: &organizationHandler{app: app},
		EmailAccount: &emailAccountHandler{app: app, sync: sync},
		Mail:         &mailHandler{app: app, sync: sync},
		LLMProvider:  &llmProviderHandler{app: app},
		Profile:      &profileHandler{app: app},
		ActivityLog:  &activityLogHandler{app: app},
		Agent:        &agentHandler{app: app, sync: sync},
		AgentBot:     &agentBotHandler{app: app},
		AgentSkill:   &agentSkillHandler{app: app},
		MCPServer:    &mcpServerHandler{app: app},
		APIKey:       &apiKeyHandler{app: app},
		MCP:          &mcpEndpointHandler{mcp: mailagent.NewMCPHandler(app, sync)},
		IPBlock:      &ipBlockHandler{app: app},
	}
}
