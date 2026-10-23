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
}

func New(app *app.Application) *Handlers {
	return &Handlers{
		Health:       &healthHandler{app: app},
		Organization: &organizationHandler{app: app},
		EmailAccount: &emailAccountHandler{app: app, sync: mailsync.New(app)},
		Mail:         &mailHandler{app: app},
		LLMProvider:  &llmProviderHandler{app: app},
	}
}
