package middlewares

import "github.com/masb0ymas/montara-mail-agent/apps/server/internal/app"

type Middlewares struct {
	app *app.Application
}

func New(app *app.Application) *Middlewares {
	return &Middlewares{app: app}
}
