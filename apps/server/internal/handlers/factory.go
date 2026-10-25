package handlers

import (
	"montara-mail-agent/server/internal/app"
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
	}
}
