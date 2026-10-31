package app

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	authula "github.com/Authula/authula"
	apikeyplugin "github.com/Authula/authula/plugins/api-key"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/ipblock"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/lib/mailoauth"
	"montara-mail-agent/server/internal/lib/period"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	DB           *sql.DB
	Repositories repositories.Repositories
	Auth         *authula.Auth
	// AIConfig is the fallback model's config for organizations without their own provider;
	// nil when no Anthropic API key is configured.
	AIConfig *llm.Config
	// AI is the fallback model client for organizations without their own
	// provider; nil when no Anthropic key is configured. Tests may set it
	// directly, which skips metering for the fallback.
	AI llm.ChatClient
	// Secrets seals stored credentials (IMAP passwords, LLM API keys).
	Secrets *lib.SecretBox
	// MailOAuth holds the configured providers' OAuth clients; a provider
	// missing from it answers its OAuth sign-in with a clear error.
	MailOAuth mailoauth.Clients
	// IPBlocks refuses blocked addresses and blocks abusive ones on its own;
	// set up with the server's middleware (cmd/api newServer).
	IPBlocks *ipblock.Guard
	// HTTPClient calls user-supplied hosts, such as an LLM base URL, through
	// lib.GuardedDialer.
	HTTPClient *http.Client

	// plans caches the pricing catalog for the enforcement hot paths (see
	// plan_catalog.go); its zero value works, filled by ReloadPlans at boot.
	plans planCatalog
}

// APIKeyService is the name the api-key plugin's API is registered under in
// Authula's service registry; the plugin itself registers nothing there.
const APIKeyService = "montara_api_key_service"

// APIKeys returns the API keys users create for the /mcp endpoint, or false
// when the api-key plugin is not set up.
func (a *Application) APIKeys() (*apikeyplugin.API, bool) {
	keys, ok := a.Auth.ServiceRegistry.Get(APIKeyService).(*apikeyplugin.API)
	return keys, ok && keys != nil
}

// ErrAINotConfigured answers an AI request of an organization with no provider
// while no fallback key is set either.
var ErrAINotConfigured = apperr.New(apperr.KindUnavailable, "AI is not configured: set an LLM provider for this organization")

// ErrQuotaExhausted answers an AI request whose weekly allowance and
// pay-as-you-go balance are both spent.
var ErrQuotaExhausted = apperr.New(apperr.KindPaymentRequired, "Weekly AI quota is used up. Top up to keep going.")

// LLMFor returns the model an organization's AI features call: its own
// provider, else the platform one, else the fallback. Every call is metered against userID's quota (the
// organization owner's for background jobs) and refused when both the weekly
// allowance and the pay-as-you-go balance are spent. It carries the one-shot
// Complete the stateless tasks use and the Chat with tool calling the agent
// loop needs.
func (a *Application) LLMFor(ctx context.Context, organizationID, userID uuid.UUID) (llm.ChatClient, error) {
	if err := a.checkQuota(ctx, userID); err != nil {
		return nil, err
	}

	p, err := a.Repositories.LLMProvider.ForOrganization(ctx, organizationID)
	if apperr.IsNotFound(err) {
		if a.AIConfig != nil {
			cfg := *a.AIConfig
			cfg.OnUsage = a.usageHook(userID, nil, cfg.Kind, cfg.Model)
			return llm.New(cfg)
		}
		if a.AI != nil {
			return a.AI, nil
		}
		return nil, ErrAINotConfigured
	}
	if err != nil {
		return nil, err
	}

	// A self-hosted model may have no key.
	var key string
	if len(p.APIKey) > 0 {
		if key, err = a.Secrets.Open(p.APIKey); err != nil {
			return nil, apperr.New(apperr.KindUnavailable, "the LLM provider's API key can't be read, save it again")
		}
	}
	return llm.New(llm.Config{
		Kind: p.Kind, BaseURL: p.BaseURL, APIKey: key, Model: p.Model, HTTPClient: a.HTTPClient,
		OnUsage: a.usageHook(userID, p.OrganizationID, p.Kind, p.Model),
	})
}

// usageHook returns the metering callback: an async insert with its own
// deadline, so a client disconnecting mid-call cannot cancel the accounting
// for work the model already did (tera-router's meter pattern).
func (a *Application) usageHook(userID uuid.UUID, organizationID *uuid.UUID, provider, model string) func(string, llm.Usage) {
	return func(purpose string, usage llm.Usage) {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			row := models.TokenUsage{
				UserID: userID, OrganizationID: organizationID,
				Provider: provider, Model: model, Purpose: purpose,
				InputTokens: usage.Input, OutputTokens: usage.Output,
			}
			if err := a.Repositories.TokenUsage.Insert(ctx, row); err != nil {
				a.Logger.Warn("token usage not recorded", "error", err)
			}
		}()
	}
}

// checkQuota refuses an AI call when the week's usage and the pay-as-you-go
// balance are both spent. The weekly allowance is the plan's; the balance is
// the overflow a top-up bought, spent only once the allowance runs out.
func (a *Application) checkQuota(ctx context.Context, userID uuid.UUID) error {
	// The Community Edition has nothing to buy, so nothing to run out of.
	if config.Community() {
		return nil
	}
	role, err := a.Repositories.User.Role(ctx, userID)
	if err != nil {
		return nil // an unknown user has no quota to check; the AI call fails on its own merits
	}
	if role == constant.RoleSuperUser {
		return nil
	}
	plan, err := a.Repositories.User.Plan(ctx, userID)
	if err != nil {
		return nil
	}
	// The allowance is the tier's plans row; an unknown or unseeded tier, or
	// a NULL weekly_tokens, enforces nothing (fail open: self-hosted servers
	// without the seed bill nobody).
	limit := a.WeeklyTokenLimit(plan)
	if limit == nil || *limit <= 0 {
		return nil
	}
	used, err := a.Repositories.TokenUsage.SumSince(ctx, userID, period.WeekStart(time.Now()))
	if err != nil {
		return err
	}
	if used < *limit {
		return nil
	}
	balance, err := a.Repositories.TokenBalance.Balance(ctx, userID, limit)
	if err != nil {
		return err
	}
	if balance > 0 {
		return nil
	}
	return ErrQuotaExhausted
}
