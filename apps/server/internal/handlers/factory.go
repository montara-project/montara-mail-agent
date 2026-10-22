package handlers

import "montara-mail-agent/server/internal/app"

type Handlers struct {
	Health       *healthHandler
	Organization *organizationHandler
	AI           *aiHandler
}

func New(app *app.Application) *Handlers {
	return &Handlers{
		Health:       &healthHandler{app: app},
		Organization: &organizationHandler{app: app},
		AI:           &aiHandler{app: app},
	}
}
