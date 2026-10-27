package main

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	sentryfiber "github.com/gofiber/contrib/v3/sentry"
	"github.com/valyala/fasthttp"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/compress"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/gofiber/fiber/v3/middleware/static"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/handlers"
	"montara-mail-agent/server/internal/mailagent"
	"montara-mail-agent/server/internal/mailsync"
	"montara-mail-agent/server/internal/middlewares"
)

// serve runs the HTTP server until SIGINT/SIGTERM, then drains in-flight
// requests before returning.
func serve(app *app.Application) error {
	server, err := newServer(app)
	if err != nil {
		return err
	}
	// A no-op unless newServer initialised Sentry.
	defer sentry.Flush(5 * time.Second)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if every := app.Config.App.MailSyncInterval; every > 0 {
		go mailsync.New(app).Run(ctx, every)
	}
	if every := app.Config.App.AgentAutoDraftInterval; every > 0 {
		go mailagent.AutoDraftLoop(ctx, app, every, app.Config.App.AgentAutoDraftDailyCap)
	}
	go sweepActivityLogs(ctx, app)

	app.Logger.Info("starting server", "port", app.Config.App.Port, "env", app.Config.App.Env, "auth", authBasePath)
	return server.Listen(fmt.Sprintf(":%d", app.Config.App.Port), fiber.ListenConfig{
		GracefulContext: ctx,
		BeforeServeFunc: func(server *fiber.App) error {
			// The agent's SSE answer streams for as long as its tools run,
			// which outlives the fixed write timeout, so that one path's
			// write deadline follows the stream's own limit instead.
			server.Server().HeaderReceived = func(header *fasthttp.RequestHeader) fasthttp.RequestConfig {
				if bytes.HasPrefix(header.RequestURI(), []byte(handlers.AgentChatPath)) {
					return fasthttp.RequestConfig{WriteTimeout: handlers.AgentChatStreamLimit + 30*time.Second}
				}
				return fasthttp.RequestConfig{}
			}
			return nil
		},
	})
}

// sweepActivityLogs deletes activity log entries older than the configured
// retention, once at boot and then once a day; the entries carry IPs and
// mail subjects, so they are not kept forever by default. Retention 0 (or a
// negative value) keeps the log forever and makes this a no-op.
func sweepActivityLogs(ctx context.Context, app *app.Application) {
	retention := app.Config.App.ActivityLogRetention
	if retention <= 0 {
		return
	}

	sweep := func() {
		sweepCtx, cancel := context.WithTimeout(ctx, time.Minute)
		defer cancel()
		deleted, err := app.Repositories.ActivityLog.DeleteOlderThan(sweepCtx, time.Now().Add(-retention))
		if err != nil {
			app.Logger.Warn("activity log retention sweep failed", "error", err)
			return
		}
		if deleted > 0 {
			app.Logger.Info("activity log retention sweep", "deleted", deleted, "retention", retention)
		}
	}

	sweep()
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sweep()
		}
	}
}

// newServer builds the Fiber app with its middleware and routes.
func newServer(app *app.Application) (*fiber.App, error) {
	proxies := splitCSV(app.Config.App.TrustedProxies)

	server := fiber.New(fiber.Config{
		AppName:          app.Config.App.Name,
		ErrorHandler:     middlewares.ErrorHandler(app.Logger),
		TrustProxy:       len(proxies) > 0,
		TrustProxyConfig: fiber.TrustProxyConfig{Proxies: proxies},
		ProxyHeader:      fiber.HeaderXForwardedFor,
		// Without it c.IP() is the raw header, which a client prefixes with
		// whatever it likes, so every request gets a fresh rate-limit key.
		EnableIPValidation: true,
		// Bound how long a slow client can hold a connection.
		// Room for a mail's attachments (dtos.MaxAttachmentBytes) and the
		// multipart framing around them; Fiber's default is 4 MB.
		BodyLimit:    20 << 20,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	})

	// Middleware
	server.Use(recover.New())
	server.Use(logger.New())
	server.Use(helmet.New(helmet.Config{
		// The default require-corp blocks cross-origin images, fonts and
		// scripts an SPA loads from a CDN; the API's JSON is unaffected.
		CrossOriginEmbedderPolicy: "unsafe-none",
		// HSTS is ignored by browsers over plain http, so sending it in
		// development is harmless; behind TLS it closes the downgrade door.
		HSTSMaxAge: 31536000,
		// The API serves the SPA (and its user-chosen API server), so the
		// page's own origin plus https covers everything it talks to. The
		// inline script is next-themes' bootstrap; the inline styles are
		// Tailwind's and the component library's. Email HTML renders in a
		// sandboxed srcdoc frame, which inherits this policy, so img-src
		// keeps http: (old newsletters) and font-src keeps https: (remote
		// fonts in email templates); scripts stay blocked in that frame by
		// its sandbox attribute, not by CSP.
		ContentSecurityPolicy: "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline'; " +
			"style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: https: http:; " +
			"font-src 'self' data: https:; " +
			"connect-src 'self' https: http://localhost:* http://127.0.0.1:*; " +
			"object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
	}))
	server.Use(requestid.New())
	// The agent's SSE route must not pass through the compressor: it buffers
	// the body, which would hold every event back until the stream ends.
	server.Use(compress.New(compress.Config{
		Next: func(c fiber.Ctx) bool { return strings.HasPrefix(c.Path(), handlers.AgentChatPath) },
	}))

	// Sentry reports panics, and only when a DSN is configured.
	if dsn := app.Config.Sentry.Dsn; dsn != "" {
		if err := sentry.Init(sentry.ClientOptions{Dsn: dsn, Environment: app.Config.App.Env}); err != nil {
			return nil, fmt.Errorf("init sentry: %w", err)
		}

		server.Use(sentryfiber.New(sentryfiber.Config{
			Repanic:         true,
			WaitForDelivery: true,
			Timeout:         5 * time.Second,
		}))
	}

	origins := splitCSV(app.Config.App.CORSAllowedOrigins)

	// CSRF: the session cookie is SameSite=Lax, which a sibling subdomain can
	// get around. This covers Authula's routes too, as they are mounted here.
	server.Use(middlewares.CrossOrigin(origins))

	// Authula answers CORS for its own routes from the same origin list, so
	// the Fiber middleware skips them to avoid duplicate headers.
	if len(origins) > 0 {
		server.Use(cors.New(cors.Config{
			Next:             func(c fiber.Ctx) bool { return strings.HasPrefix(c.Path(), authBasePath) },
			AllowOrigins:     origins,
			AllowCredentials: true,
			// Without this a browser client cannot read the marker that says a
			// write was replayed instead of applied (see middlewares.Idempotency).
			ExposeHeaders: []string{middlewares.HeaderIdempotentReplayed},
		}))
	}

	server.Use(static.New("./public"))

	routes(server, app)

	// The SPA answers whatever the API routes did not: its built files, then
	// index.html for client-side routes. /api and /health stay API-only.
	if dir := app.Config.App.SPADir; dir != "" {
		spa, err := middlewares.SPA(middlewares.SPAConfig{
			FS:      os.DirFS(dir),
			Exclude: []string{"/api", "/health"},
		})
		if err != nil {
			return nil, err
		}
		server.Use(spa)
	}

	return server, nil
}
