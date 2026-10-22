package app

import (
	"database/sql"
	"log/slog"

	authula "github.com/Authula/authula"

	"github.com/masb0ymas/montara-mail-agent/apps/server/internal/config"
	"github.com/masb0ymas/montara-mail-agent/apps/server/internal/repositories"
)

type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	DB           *sql.DB
	Repositories repositories.Repositories
	Auth         *authula.Auth
}
