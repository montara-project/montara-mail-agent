// Package mailoauth connects mailboxes over OAuth2: it builds each provider's
// consent URL, exchanges and refreshes tokens, and reads the mailbox address
// out of the token response. Connected mailboxes sign in to IMAP and SMTP
// with the XOAUTH2 mechanism, which Google, Microsoft, Yahoo and Zoho offer
// publicly; iCloud and Lark only connect with an app password.
package mailoauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/oauth2"

	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// Provider is one mail provider's OAuth2 endpoints, IMAP scopes and the way
// its token response names the mailbox.
type Provider struct {
	AuthURL  string
	TokenURL string
	Scopes   []string
	// Userinfo, when set, answers a GET with a bearer token; its JSON carries
	// the mailbox address under one of EmailFields.
	Userinfo    string
	EmailFields []string
	// AuthOptions are extra consent-URL query params; some providers hand out
	// a refresh token only when asked to.
	AuthOptions []oauth2.AuthCodeOption
	// PKCE marks providers that accept a code challenge on the consent URL.
	PKCE bool
}

// emailFields lists the JSON claims a mailbox address is read from, in order.
var emailFields = []string{"email", "preferred_username"}

var providers = map[string]Provider{
	constant.ProviderGmail: {
		AuthURL:  "https://accounts.google.com/o/oauth2/v2/auth",
		TokenURL: "https://oauth2.googleapis.com/token",
		// The mail scope covers IMAP and SMTP; openid and email put the
		// mailbox address into the token response's id_token.
		Scopes: []string{"https://mail.google.com/", "openid", "email"},
		// Google only sends a refresh token on the first consent, or when the
		// consent screen is forced again.
		AuthOptions: []oauth2.AuthCodeOption{
			oauth2.SetAuthURLParam("access_type", "offline"),
			oauth2.SetAuthURLParam("prompt", "consent"),
		},
		PKCE: true,
	},
	constant.ProviderOutlook: {
		AuthURL:  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
		TokenURL: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
		// The common tenant signs in personal (outlook.com) and Microsoft 365
		// accounts alike; offline_access is what makes a refresh token appear.
		Scopes: []string{
			"openid", "email", "profile", "offline_access",
			"https://outlook.office.com/IMAP.AccessAsUser.All",
			"https://outlook.office.com/SMTP.Send",
		},
		PKCE: true,
	},
	constant.ProviderYahoo: {
		AuthURL:  "https://api.login.yahoo.com/oauth2/request_auth",
		TokenURL: "https://api.login.yahoo.com/oauth2/get_token",
		Scopes:   []string{"mail-r", "mail-w", "openid", "profile", "email"},
		Userinfo: "https://api.login.yahoo.com/openid/v1/userinfo",
	},
	constant.ProviderZoho: {
		AuthURL:  "https://accounts.zoho.com/oauth/v2/auth",
		TokenURL: "https://accounts.zoho.com/oauth/v2/token",
		// The full mail scope covers IMAP and SMTP; the .com host serves the
		// US data center, other regions run their own accounts.* host.
		Scopes: []string{"https://mail.zoho.com/"},
		// Zoho hands out a refresh token only when asked to (no offline_access
		// scope; the query param does it).
		AuthOptions: []oauth2.AuthCodeOption{oauth2.SetAuthURLParam("access_type", "offline")},
		Userinfo:    "https://accounts.zoho.com/oauth/user/info",
	},
}

// Get returns the provider's OAuth definition; ok is false for a provider
// with no OAuth mailbox sign-in (imap, icloud, lark).
func Get(provider string) (Provider, bool) {
	p, ok := providers[provider]
	return p, ok
}

// Credentials are one provider's OAuth client.
type Credentials struct {
	ClientID     string
	ClientSecret string
}

// Clients maps the configured providers to their OAuth client; For answers
// false for a provider whose client id is not set, which disables its OAuth
// sign-in.
type Clients map[string]Credentials

func (c Clients) For(provider string) (Credentials, bool) {
	creds, ok := c[provider]
	if !ok || creds.ClientID == "" || creds.ClientSecret == "" {
		return Credentials{}, false
	}
	return creds, true
}

// RedirectURI is where a provider sends the browser back to after consent;
// it must be registered with the provider's OAuth client.
func RedirectURI(baseURL, provider string) string {
	return baseURL + "/api/v1/email-accounts/oauth/" + provider + "/callback"
}

// GenerateVerifier makes the PKCE code verifier a flow carries from the
// consent URL to the code exchange.
func GenerateVerifier() string {
	return oauth2.GenerateVerifier()
}

// ConsentURL builds the consent URL the browser is sent to; state carries
// the signed flow context (see state.go) and the PKCE challenge when the
// provider accepts one.
func (p Provider) ConsentURL(creds Credentials, redirectURI, state, verifier string) string {
	opts := append([]oauth2.AuthCodeOption(nil), p.AuthOptions...)
	if p.PKCE && verifier != "" {
		opts = append(opts, oauth2.S256ChallengeOption(verifier))
	}
	return p.config(creds, redirectURI).AuthCodeURL(state, opts...)
}

// Exchange trades the consent code for tokens; the verifier completes the
// provider's PKCE check when the flow started with one.
func (p Provider) Exchange(ctx context.Context, creds Credentials, redirectURI, code, verifier string) (*oauth2.Token, error) {
	opts := []oauth2.AuthCodeOption(nil)
	if verifier != "" {
		opts = append(opts, oauth2.VerifierOption(verifier))
	}
	return p.config(creds, redirectURI).Exchange(ctx, code, opts...)
}

// Refresh trades a refresh token for a fresh access token.
func (p Provider) Refresh(ctx context.Context, creds Credentials, refreshToken string) (*oauth2.Token, error) {
	return p.config(creds, "").TokenSource(ctx, &oauth2.Token{RefreshToken: refreshToken}).Token()
}

func (p Provider) config(creds Credentials, redirectURI string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     creds.ClientID,
		ClientSecret: creds.ClientSecret,
		Endpoint:     oauth2.Endpoint{AuthURL: p.AuthURL, TokenURL: p.TokenURL},
		RedirectURL:  redirectURI,
		Scopes:       p.Scopes,
	}
}

// MailboxEmail reads the address the tokens belong to: the id_token's claims
// when the token response carries one, else the userinfo endpoint. The
// id_token comes straight from the token endpoint over TLS, so its claims
// are read without fetching the provider's verification keys.
func (p Provider) MailboxEmail(ctx context.Context, client *http.Client, idToken string) (string, error) {
	if idToken != "" {
		if email := jwtEmail(idToken, emailFields); email != "" {
			return email, nil
		}
	}
	if p.Userinfo == "" || client == nil {
		return "", errors.New("the token response carries no mailbox address")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.Userinfo, nil)
	if err != nil {
		return "", err
	}
	res, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("read the mailbox address: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("read the mailbox address: %s answered %d", p.Userinfo, res.StatusCode)
	}

	var claims map[string]any
	if err := json.NewDecoder(res.Body).Decode(&claims); err != nil {
		return "", fmt.Errorf("read the mailbox address: %w", err)
	}
	if email := claimEmail(claims, emailFields); email != "" {
		return email, nil
	}
	return "", errors.New("the token response carries no mailbox address")
}

// jwtEmail decodes the middle segment of a JWT and reads the email claims
// from it, case-insensitively (Zoho capitalizes "Email").
func jwtEmail(token string, fields []string) string {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return ""
	}
	claims, err := decodeClaims(parts[1])
	if err != nil {
		return ""
	}
	return claimEmail(claims, fields)
}

func decodeClaims(segment string) (map[string]any, error) {
	for _, enc := range []*base64.Encoding{base64.RawURLEncoding, base64.URLEncoding} {
		if raw, err := enc.DecodeString(segment); err == nil {
			var claims map[string]any
			if err := json.Unmarshal(raw, &claims); err == nil {
				return claims, nil
			}
		}
	}
	return nil, errors.New("not a JWT claims segment")
}

func claimEmail(claims map[string]any, fields []string) string {
	lowered := make(map[string]any, len(claims))
	for k, v := range claims {
		lowered[strings.ToLower(k)] = v
	}
	for _, f := range fields {
		if v, ok := lowered[f].(string); ok && strings.Contains(v, "@") {
			return v
		}
	}
	return ""
}

// TokenStore persists a refreshed token pair on the account; the email
// account repository implements it.
type TokenStore interface {
	SetOAuthTokens(ctx context.Context, id uuid.UUID, access, refresh []byte, expiry time.Time) error
}

// AccessToken returns the account's working IMAP access token: the stored
// one while it is still fresh, else a refresh exchange whose new pair is
// stored through store. ponytail: two replicas may refresh at once and the
// loser's write is overwritten; every provider here honors a refresh token
// that was already turned in, so that is safe, and a Postgres advisory lock
// per account becomes worthwhile with more than one replica.
func AccessToken(ctx context.Context, clients Clients, secrets *lib.SecretBox, store TokenStore, account models.EmailAccount) (string, error) {
	if len(account.OAuthRefreshToken) == 0 {
		return "", errors.New("the account has no OAuth tokens, connect it again")
	}
	refresh, err := secrets.Open(account.OAuthRefreshToken)
	if err != nil {
		return "", errors.New("the saved tokens can't be read, connect the account again")
	}
	// A margin keeps a token that dies mid-sync from being reused.
	if account.OAuthTokenExpiry != nil && time.Until(*account.OAuthTokenExpiry) > 30*time.Second && len(account.OAuthAccessToken) > 0 {
		if access, err := secrets.Open(account.OAuthAccessToken); err == nil {
			return access, nil
		}
	}

	p, ok := Get(account.Provider)
	if !ok {
		return "", fmt.Errorf("%s has no OAuth sign-in", account.Provider)
	}
	creds, ok := clients.For(account.Provider)
	if !ok {
		return "", fmt.Errorf("OAuth for %s isn't configured on this server", account.Provider)
	}
	token, err := p.Refresh(ctx, creds, refresh)
	if err != nil {
		return "", fmt.Errorf("refresh the access token: %w", err)
	}
	if token.RefreshToken == "" {
		token.RefreshToken = refresh
	}
	// A provider that sends no expiry means its tokens live about an hour.
	if token.Expiry.IsZero() {
		token.Expiry = time.Now().Add(time.Hour)
	}
	if err := store.SetOAuthTokens(ctx, account.ID, secrets.Seal(token.AccessToken), secrets.Seal(token.RefreshToken), token.Expiry); err != nil {
		return "", fmt.Errorf("store the refreshed tokens: %w", err)
	}
	return token.AccessToken, nil
}
