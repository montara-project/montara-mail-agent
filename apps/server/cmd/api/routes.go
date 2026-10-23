package main

import (
	fiberadapter "github.com/Authula/authula/adapters/fiber"
	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/handlers"
	"montara-mail-agent/server/internal/middlewares"
)

// Per-IP request budgets per minute: tight on the auth routes and on model
// calls and mailbox syncs, loose on the rest of the API.
const (
	authRateLimit = 30
	apiRateLimit  = 120
	aiRateLimit   = 10
)

func routes(r *fiber.App, app *app.Application) {
	h := handlers.New(app)
	m := middlewares.New(app)

	// With an SPA, / is its index.html (see server.go).
	if app.Config.App.SPADir == "" {
		r.Get("/", func(c fiber.Ctx) error {
			return c.JSON(fiber.Map{
				"message": "Hello, World!",
			})
		})
	}
	r.Get("/health", h.Health.Check)

	// Authula: email & password, Google OAuth2 and magic-link sign-in,
	// plus GET /me and POST /sign-out, all under authBasePath. The limiter
	// guards password guessing and sign-in/reset email flooding.
	r.Use(authBasePath,
		middlewares.RateLimit(authRateLimit, app.Config.App.Env == config.EnvDevelopment, splitCSV(app.Config.App.RateLimitExemptIPs)),
		fiberadapter.New(fiberadapter.Config{Handler: app.Auth.Handler()}),
	)

	exemptLoopback := app.Config.App.Env == config.EnvDevelopment
	exemptIPs := splitCSV(app.Config.App.RateLimitExemptIPs)

	// ponytail: the limiters count in memory, so each replica has its own
	// budget; give them shared storage once there is more than one instance.
	v1 := r.Group("/api/v1", middlewares.RateLimit(apiRateLimit, exemptLoopback, exemptIPs))

	// Every route below needs a signed-in user; what they may touch follows
	// from their organizations (see handlers.member). Idempotency comes last,
	// after the caller is known, and replays a repeated write instead of
	// applying it twice (see middlewares.Idempotency). One guard serves every
	// write route: its keys are already scoped per route, and a shared cache
	// means a single in-memory store instead of one per route.
	idempotent := middlewares.Idempotency()

	// Model calls and IMAP syncs are slow and may be paid, so they share a
	// tighter budget.
	slow := middlewares.RateLimit(aiRateLimit, exemptLoopback, exemptIPs)

	// The signed-in user's own account. Password checks share the slow
	// budget, which also slows guessing the current password.
	me := v1.Group("/me", m.Authorization)
	me.Get("/security", h.Profile.Security)
	me.Patch("/", idempotent, h.Profile.Update)
	me.Put("/password", slow, idempotent, h.Profile.ChangePassword)

	organizations := v1.Group("/organizations", m.Authorization)
	organizations.Get("/", h.Organization.List)
	organizations.Get("/:id", h.Organization.Get)
	organizations.Post("/", idempotent, h.Organization.Create)
	organizations.Put("/:id", idempotent, h.Organization.Update)
	organizations.Delete("/:id", idempotent, h.Organization.Delete)
	organizations.Put("/:id/restore", idempotent, h.Organization.Restore)
	organizations.Delete("/:id/force", idempotent, h.Organization.DeletePermanently)
	organizations.Get("/:id/stats", h.Organization.Stats)
	organizations.Get("/:id/email-accounts", h.EmailAccount.List)
	organizations.Post("/:id/email-accounts", slow, idempotent, h.EmailAccount.Create)
	organizations.Get("/:id/llm-provider", h.LLMProvider.Get)
	organizations.Put("/:id/llm-provider", idempotent, h.LLMProvider.Put)
	organizations.Delete("/:id/llm-provider", idempotent, h.LLMProvider.Delete)
	organizations.Post("/:id/llm-provider/models", slow, h.LLMProvider.Models)

	emailAccounts := v1.Group("/email-accounts", m.Authorization)
	emailAccounts.Get("/:id/mails", h.EmailAccount.Mails)
	emailAccounts.Delete("/:id", idempotent, h.EmailAccount.Delete)
	emailAccounts.Post("/:id/sync", slow, h.EmailAccount.Sync)
	emailAccounts.Post("/:id/send", slow, idempotent, h.EmailAccount.Send)

	mails := v1.Group("/mails", m.Authorization)
	mails.Get("/:id", h.Mail.Get)
	mails.Patch("/:id", idempotent, h.Mail.Patch)
	// Each of these talks to the mail server, so they share the slow budget.
	mails.Delete("/:id", slow, idempotent, h.Mail.Delete)
	mails.Post("/:id/move", slow, idempotent, h.Mail.Move)
	mails.Post("/:id/forward", slow, idempotent, h.Mail.Forward)
	mails.Post("/:id/reply", slow, idempotent, h.Mail.Reply)
	mails.Post("/:id/summary", slow, h.Mail.Summary)
	mails.Post("/:id/reply-suggestions", slow, h.Mail.ReplySuggestions)
}
