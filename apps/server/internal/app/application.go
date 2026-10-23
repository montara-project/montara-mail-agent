package app

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"

	authula "github.com/Authula/authula"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/repositories"
)

type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	DB           *sql.DB
	Repositories repositories.Repositories
	Auth         *authula.Auth
	// AI is the fallback model for organizations without their own provider;
	// nil when no Anthropic API key is configured.
	AI llm.Client
	// Secrets seals stored credentials (IMAP passwords, LLM API keys).
	Secrets *lib.SecretBox
	// HTTPClient calls user-supplied hosts, such as an LLM base URL, through
	// lib.GuardedDialer.
	HTTPClient *http.Client
}

// ErrAINotConfigured answers an AI request of an organization with no provider
// while no fallback key is set either.
var ErrAINotConfigured = apperr.New(apperr.KindUnavailable, "AI is not configured: set an LLM provider for this organization")

// LLMFor returns the model an organization's AI features call: its own
// provider, else the fallback.
func (a *Application) LLMFor(ctx context.Context, organizationID uuid.UUID) (llm.Client, error) {
	p, err := a.Repositories.LLMProvider.Get(ctx, organizationID)
	if apperr.IsNotFound(err) {
		if a.AI == nil {
			return nil, ErrAINotConfigured
		}
		return a.AI, nil
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
	return llm.New(llm.Config{Kind: p.Kind, BaseURL: p.BaseURL, APIKey: key, Model: p.Model, HTTPClient: a.HTTPClient})
}
