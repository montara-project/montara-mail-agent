package app

import (
	"database/sql"
	"log/slog"

	authula "github.com/Authula/authula"
	"github.com/anthropics/anthropic-sdk-go"

	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/repositories"
)

type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	DB           *sql.DB
	Repositories repositories.Repositories
	Auth         *authula.Auth
	// AI is nil when no Anthropic API key is configured.
	AI *anthropic.Client
}
