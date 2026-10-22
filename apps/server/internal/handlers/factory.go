package handlers

import "montara-mail-agent/server/internal/app"

type Handlers struct {
	Health   *healthHandler
	Category *categoryHandler
}

func New(app *app.Application) *Handlers {
	return &Handlers{
		Health:   &healthHandler{app: app},
		Category: &categoryHandler{app: app},
	}
}
