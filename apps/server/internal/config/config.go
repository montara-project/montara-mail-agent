package config

import (
	"log"
	"time"
)

// Accepted App.Env values. Only EnvDevelopment enables development-only
// behaviour: the loopback rate-limit exemption and session cookies without
// Secure. The default is EnvProduction, so forgetting ENV fails safe.
const (
	EnvDevelopment = "development"
	EnvStaging     = "staging"
	EnvProduction  = "production"
)

// Edition is the build's edition: EditionCloud (open sign-up) or
// EditionCommunity (one self-hosted user, no sign-up). The Docker build sets
// it with -ldflags; the web app inside the image is built for the same one.
var Edition = EditionCloud

const (
	EditionCloud     = "cloud"
	EditionCommunity = "community"
)

// A mistyped -ldflags value stops every binary, cmd/migrate included, before
// it acts as the wrong edition.
func init() {
	if Edition != EditionCloud && Edition != EditionCommunity {
		log.Fatalf("edition must be %s or %s, got %q", EditionCloud, EditionCommunity, Edition)
	}
}

// Community reports whether this is the Community Edition.
func Community() bool {
	return Edition == EditionCommunity
}

// SessionCookieName is the cookie Authula issues on sign-in; the API's
// authorization middleware reads the same cookie.
const SessionCookieName = "authula.session_token"

type Config struct {
	App       ConfigApp
	DB        ConfigDB
	Auth      ConfigAuth
	Sentry    ConfigSentry
	AI        ConfigAI
	MailOAuth ConfigMailOAuth
}

// ConfigAI configures the Claude-backed AI features; an empty key disables them.
type ConfigAI struct {
	AnthropicAPIKey string
}

// ConfigMailOAuth configures the OAuth clients that connect mailboxes for
// the providers that offer it (Google, Microsoft, Yahoo, Zoho); a provider
// with no client id answers its OAuth button with a clear error, and its
// app password way in keeps working. iCloud and Lark offer no public IMAP
// OAuth at all, so they take no entry.
type ConfigMailOAuth struct {
	GoogleClientID        string
	GoogleClientSecret    string
	MicrosoftClientID     string
	MicrosoftClientSecret string
	YahooClientID         string
	YahooClientSecret     string
	ZohoClientID          string
	ZohoClientSecret      string
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
	// ActivityLogRetention is how long activity log entries are kept before
	// a daily sweep deletes them; the entries carry IPs and mail subjects,
	// so forever is rarely wanted. 0 keeps the log forever.
	ActivityLogRetention time.Duration
	// AgentAutoDraftInterval is how often the agent's background automation
	// drafts replies for important mail; 0 disables the automation.
	AgentAutoDraftInterval time.Duration
	// AgentAutoDraftDailyCap bounds how many drafts the automation may queue
	// per organization per day, so a chatty inbox cannot run up the bill.
	AgentAutoDraftDailyCap int
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
