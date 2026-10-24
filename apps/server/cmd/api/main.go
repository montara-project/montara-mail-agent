package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/lib/mailoauth"
	"montara-mail-agent/server/internal/repositories"
	"montara-mail-agent/server/internal/seeders"
)

// fallbackModel serves organizations without their own LLM provider.
const fallbackModel = "claude-opus-5-5"

// outboundClient calls user-supplied hosts, such as an organization's LLM
// base URL, through the guarded dialer.
func outboundClient(allowPrivate bool) *http.Client {
	return &http.Client{
		Timeout: 2 * time.Minute,
		Transport: &http.Transport{
			DialContext:         lib.GuardedDialer(allowPrivate).DialContext,
			TLSHandshakeTimeout: 15 * time.Second,
			ForceAttemptHTTP2:   true,
		},
	}
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	var cfg config.Config
	parseFlag(&cfg)

	level := slog.LevelInfo
	if cfg.App.Debug {
		level = slog.LevelDebug
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	// The repositories log their queries through the default logger.
	slog.SetDefault(logger)

	if cfg.App.MigrateOnBoot {
		if err := migrateUp(&cfg.DB, logger); err != nil {
			return err
		}
	}

	apiDB := cfg.DB
	apiDB.MaxOpenConns, apiDB.MaxIdleConns = apiPoolSize(cfg.DB.MaxOpenConns), apiPoolSize(cfg.DB.MaxIdleConns)
	db, err := connectDB(&apiDB)
	if err != nil {
		return fmt.Errorf("connect database: %w", err)
	}
	defer db.Close()

	repos := repositories.New(db)
	mirror := mirrorUser(&repos.User)

	// Creating the instance runs Authula's own migrations.
	auth := newAuth(cfg, mirror, logger)
	defer auth.CloseSystems()
	defer auth.ClosePlugins()

	// Repairs mirror rows a failed hook left missing or stale.
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	err = repos.User.Reconcile(ctx)
	cancel()
	if err != nil {
		return fmt.Errorf("reconcile users mirror: %w", err)
	}

	// The Community Edition's only account is the super user. A database that
	// holds others (one the Cloud Edition ran on) would still let them sign
	// in, so it is refused, and before seeding, which would otherwise reset
	// that database's super user password.
	if config.Community() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		others, err := repos.User.HasOtherThan(ctx, cfg.App.SuperUserEmail)
		cancel()
		if err != nil {
			return fmt.Errorf("check community edition accounts: %w", err)
		}
		if others {
			return errors.New("community edition allows only the super user, but the database holds other accounts: run the cloud edition on it, or start from an empty database")
		}
	}

	// Seeding follows Authula because the super user is created through it.
	if cfg.App.SeedOnBoot {
		superUser := seeders.SuperUserSeeder{
			DB:       db,
			Auth:     auth.CoreServices(),
			Promote:  promoteSuperUser(&repos.User, mirror),
			Email:    cfg.App.SuperUserEmail,
			Password: cfg.App.SuperUserPassword,
		}
		if err := seedAll(db, superUser, logger); err != nil {
			return err
		}
	}

	var ai llm.Client
	if cfg.AI.AnthropicAPIKey != "" {
		ai, err = llm.New(llm.Config{
			Kind:       llm.KindAnthropic,
			APIKey:     cfg.AI.AnthropicAPIKey,
			Model:      fallbackModel,
			HTTPClient: &http.Client{Timeout: 2 * time.Minute},
		})
		if err != nil {
			return err
		}
	} else {
		logger.Warn("no fallback AI: anthropic-api-key is not set, so only organizations with their own LLM provider get AI features")
	}

	secrets, err := lib.NewSecretBox(cfg.App.Secret)
	if err != nil {
		return err
	}

	// Only the providers with a configured client take part in OAuth mailbox
	// sign-in; the rest answer their OAuth button with a clear error.
	mailOAuth := mailoauth.Clients{
		constant.ProviderGmail:   {ClientID: cfg.MailOAuth.GoogleClientID, ClientSecret: cfg.MailOAuth.GoogleClientSecret},
		constant.ProviderOutlook: {ClientID: cfg.MailOAuth.MicrosoftClientID, ClientSecret: cfg.MailOAuth.MicrosoftClientSecret},
		constant.ProviderYahoo:   {ClientID: cfg.MailOAuth.YahooClientID, ClientSecret: cfg.MailOAuth.YahooClientSecret},
		constant.ProviderZoho:    {ClientID: cfg.MailOAuth.ZohoClientID, ClientSecret: cfg.MailOAuth.ZohoClientSecret},
	}

	return serve(&app.Application{
		Config:       cfg,
		Logger:       logger,
		DB:           db,
		Repositories: repos,
		Auth:         auth,
		AI:           ai,
		Secrets:      secrets,
		MailOAuth:    mailOAuth,
		HTTPClient:   outboundClient(cfg.App.AllowPrivateHosts),
	})
}
