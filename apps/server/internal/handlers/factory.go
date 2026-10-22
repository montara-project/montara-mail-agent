package handlers

import "github.com/masb0ymas/montara-mail-agent/apps/server/internal/app"

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
