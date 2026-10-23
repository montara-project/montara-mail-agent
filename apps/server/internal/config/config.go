package config

import "time"

// Accepted App.Env values. Only EnvDevelopment enables development-only
// behaviour: the loopback rate-limit exemption and session cookies without
// Secure. The default is EnvProduction, so forgetting ENV fails safe.
const (
	EnvDevelopment = "development"
	EnvStaging     = "staging"
	EnvProduction  = "production"
)

// SessionCookieName is the cookie Authula issues on sign-in; the API's
// authorization middleware reads the same cookie.
const SessionCookieName = "authula.session_token"

type Config struct {
	App    ConfigApp
	DB     ConfigDB
	Auth   ConfigAuth
	Sentry ConfigSentry
	AI     ConfigAI
}

// ConfigAI configures the Claude-backed AI features; an empty key disables them.
type ConfigAI struct {
	AnthropicAPIKey string
}

// ConfigAuth configures the embedded Authula server.
type ConfigAuth struct {
	BaseURL            string
	EmailFrom          string
	ResendAPIKey       string
	GoogleClientID     string
	GoogleClientSecret string
}

type ConfigApp struct {
	Env                string
	Debug              bool
	Port               int
	Name               string
	Secret             string
	MigrateOnBoot      bool
	SeedOnBoot         bool
	SuperUserEmail     string
	SuperUserPassword  string
	CORSAllowedOrigins string
	RateLimitExemptIPs string
	TrustedProxies     string
	// SPADir is the build output of a single-page app served at /; empty
	// disables it.
	SPADir string
	// AllowPrivateHosts lets user-supplied hosts (IMAP servers, LLM base
	// URLs) resolve to loopback or private addresses, e.g. a local Ollama.
	AllowPrivateHosts bool
	// MailSyncInterval is how often every account is synced; 0 disables
	// the background sync.
	MailSyncInterval time.Duration
}

type ConfigDB struct {
	DSN          string
	MaxOpenConns int
	MaxIdleConns int
	MaxIdleTime  time.Duration
}

type ConfigSentry struct {
	Dsn string
}
