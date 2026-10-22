package app

import (
	"database/sql"
	"log/slog"

	authula "github.com/Authula/authula"

	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/repositories"
)

type Application struct {
	Config       config.Config
	Logger       *slog.Logger
	DB           *sql.DB
	Repositories repositories.Repositories
	Auth         *authula.Auth
}
