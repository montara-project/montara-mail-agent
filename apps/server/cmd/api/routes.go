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
	me.Get("/activity-logs", h.ActivityLog.ListMine)
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
	organizations.Get("/:id/activity-logs", h.ActivityLog.ListByOrganization)
	organizations.Get("/:id/email-accounts", h.EmailAccount.List)
	organizations.Post("/:id/email-accounts", slow, idempotent, h.EmailAccount.Create)
	organizations.Post("/:id/email-accounts/oauth/:provider", h.EmailAccount.OAuthStart)
	organizations.Get("/:id/llm-provider", h.LLMProvider.Get)
	organizations.Put("/:id/llm-provider", idempotent, h.LLMProvider.Put)
	organizations.Delete("/:id/llm-provider", idempotent, h.LLMProvider.Delete)
	organizations.Post("/:id/llm-provider/models", slow, h.LLMProvider.Models)

	// Every provider the user can see, the global one (super user only to
	// change) and moving a provider between organizations and global.
	llmProviders := v1.Group("/llm-providers", m.Authorization)
	llmProviders.Get("/", h.LLMProvider.List)
	llmProviders.Put("/global", idempotent, h.LLMProvider.Put)
	llmProviders.Delete("/global", idempotent, h.LLMProvider.Delete)
	llmProviders.Post("/global/models", slow, h.LLMProvider.Models)
	llmProviders.Put("/:id/scope", idempotent, h.LLMProvider.SetScope)
	organizations.Get("/:id/mcp-servers", h.MCPServer.List)
	organizations.Post("/:id/mcp-servers", slow, idempotent, h.MCPServer.Create)
	organizations.Post("/:id/mcp-servers/test", slow, h.MCPServer.TestDraft)
	organizations.Get("/:id/agent-bots", h.AgentBot.List)
	organizations.Post("/:id/agent-bots", idempotent, h.AgentBot.Create)
	organizations.Get("/:id/skills", h.AgentSkill.List)
	organizations.Post("/:id/skills", idempotent, h.AgentSkill.Create)
	organizations.Put("/:id/skills/builtin/:key", idempotent, h.AgentSkill.SetBuiltin)

	// The OAuth consent flow's return address: a browser navigation from the
	// provider, so no signed-in caller and no API envelope — the handler
	// redirects to the web app either way. Registered before the
	// email-accounts group below: that group's authorization middleware
	// mounts on the shared prefix and would otherwise run for it too.
	v1.Get("/email-accounts/oauth/:provider/callback", h.EmailAccount.OAuthCallback)

	emailAccounts := v1.Group("/email-accounts", m.Authorization)
	emailAccounts.Get("/:id/mails", h.EmailAccount.Mails)
	emailAccounts.Delete("/:id", idempotent, h.EmailAccount.Delete)
	emailAccounts.Post("/:id/sync", slow, h.EmailAccount.Sync)
	emailAccounts.Post("/:id/send", slow, idempotent, h.EmailAccount.Send)

	mails := v1.Group("/mails", m.Authorization)
	mails.Post("/bulk", slow, idempotent, h.Mail.Bulk)
	mails.Get("/:id", h.Mail.Get)
	mails.Patch("/:id", idempotent, h.Mail.Patch)
	// Each of these talks to the mail server, so they share the slow budget.
	mails.Delete("/:id", slow, idempotent, h.Mail.Delete)
	mails.Post("/:id/move", slow, idempotent, h.Mail.Move)
	mails.Post("/:id/forward", slow, idempotent, h.Mail.Forward)
	mails.Post("/:id/reply", slow, idempotent, h.Mail.Reply)
	mails.Post("/:id/summary", slow, h.Mail.Summary)
	mails.Post("/:id/reply-suggestions", slow, h.Mail.ReplySuggestions)
	mails.Post("/:id/draft-reply", slow, h.Mail.DraftReply)
	mails.Post("/:id/skills/:key", slow, h.Mail.RunSkill)

	// A hosted MCP server's sign-in returns here: a browser navigation, so
	// registered before the authorized group below, like the mail callback.
	v1.Get("/mcp-servers/oauth/callback", h.MCPServer.OAuthCallback)

	// Contacting a server (sync, test, sign-in) shares the slow budget: each
	// one reaches out to a host the user typed.
	mcpServers := v1.Group("/mcp-servers", m.Authorization)
	mcpServers.Put("/:id", slow, idempotent, h.MCPServer.Update)
	mcpServers.Delete("/:id", idempotent, h.MCPServer.Delete)
	mcpServers.Post("/:id/sync", slow, h.MCPServer.Sync)
	mcpServers.Post("/:id/test", slow, h.MCPServer.Test)
	mcpServers.Post("/:id/oauth/start", slow, h.MCPServer.OAuthStart)

	// Agent bots are organization settings, so the flat group lets the web app
	// edit one by its own id without repeating the organization.
	agentBots := v1.Group("/agent-bots", m.Authorization)
	agentBots.Get("/:id", h.AgentBot.Get)
	agentBots.Put("/:id", idempotent, h.AgentBot.Update)
	agentBots.Delete("/:id", idempotent, h.AgentBot.Delete)

	// Custom skills, by their own id like the agent bots.
	skills := v1.Group("/skills", m.Authorization)
	skills.Put("/:id", idempotent, h.AgentSkill.Update)
	skills.Delete("/:id", idempotent, h.AgentSkill.Delete)

	// The mail agent: a copilot over one mailbox, its conversation history,
	// and the approvals its proposals wait for. The chat streams its answer
	// over SSE, and one turn can run several model calls, so it shares the
	// AI budget rather than the general one.
	agent := v1.Group("/agent", m.Authorization, middlewares.RateLimit(aiRateLimit, exemptLoopback, exemptIPs))
	agent.Get("/conversations", h.Agent.Conversations)
	agent.Post("/conversations", h.Agent.CreateConversation)
	agent.Get("/conversations/:id", h.Agent.Conversation)
	agent.Delete("/conversations/:id", h.Agent.DeleteConversation)
	agent.Post("/chat", h.Agent.Chat)
	agent.Post("/actions/:id/approve", h.Agent.ApproveAction)
	agent.Post("/actions/:id/deny", h.Agent.DenyAction)
	agent.Get("/drafts", h.Agent.Drafts)
	agent.Post("/drafts/:id/approve", h.Agent.ApproveDraft)
	agent.Post("/drafts/:id/discard", h.Agent.DiscardDraft)
}
