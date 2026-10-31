package main

import (
	"database/sql"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	authula "github.com/Authula/authula"
	authulamodels "github.com/Authula/authula/models"
	totpservices "github.com/Authula/authula/plugins/totp/services"

	"montara-mail-agent/server/internal/config"
)

// fakeOAuthCallback finishes a sign-in the way Authula's OAuth2 callback does,
// without the provider: a new session, then a redirect marked as handled.
func fakeOAuthCallback(auth *authula.Auth) authulamodels.Route {
	return authulamodels.Route{
		Method: http.MethodGet,
		Path:   "/oauth2/test-callback",
		Handler: http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			reqCtx, _ := authulamodels.GetRequestContext(r.Context())
			services := auth.CoreServices()
			token, err := services.TokenService.Generate()
			if err != nil {
				reqCtx.SetJSONResponse(http.StatusInternalServerError, map[string]string{"message": err.Error()})
				return
			}
			userID := r.URL.Query().Get("user")
			session, err := services.SessionService.Create(r.Context(), userID, services.TokenService.Hash(token), nil, nil, time.Hour)
			if err != nil {
				reqCtx.SetJSONResponse(http.StatusInternalServerError, map[string]string{"message": err.Error()})
				return
			}
			reqCtx.SetActorInContext(&authulamodels.Actor{ID: userID, Type: authulamodels.ActorUser})
			reqCtx.Values[authulamodels.ContextSessionID.String()] = session.ID
			reqCtx.Values[authulamodels.ContextSessionToken.String()] = token
			reqCtx.Values[authulamodels.ContextAuthSuccess.String()] = true
			reqCtx.RedirectURL = "http://localhost:3000/sign-in?via=google"
			reqCtx.ResponseStatus = http.StatusFound
			reqCtx.Handled = true
		}),
	}
}

// testAccountSettings walks the settings pages of a signed-in user: profile,
// two-factor sign-in, then the password change, which ends every session.
// cookies returns the Set-Cookie pairs of the last answer.
func testAccountSettings(t *testing.T, call callFunc, cookies func() string, db *sql.DB, email, password string) {
	t.Helper()

	signIn := func(password string) (int, map[string]any) {
		return call(http.MethodPost, "/api/v1/auth/email-password/sign-in", "", map[string]string{"email": email, "password": password})
	}
	status, out := signIn(password)
	if status != http.StatusOK || out["access_token"] == nil {
		t.Fatalf("sign in: %d %v", status, out)
	}
	token := out["access_token"].(string)

	// An OAuth2 callback leaves the session cookie the web app trades for tokens.
	oauthCallback := "/api/v1/auth/oauth2/test-callback?user=" + out["user"].(map[string]any)["id"].(string)
	if status, out := call(http.MethodGet, oauthCallback, "", nil); status != http.StatusFound || !strings.Contains(cookies(), config.SessionCookieName+"=") {
		t.Fatalf("oauth callback: %d %v, cookies %q", status, out, cookies())
	}
	if status, out := call(http.MethodPost, "/api/v1/auth/token", "", nil, "Cookie", cookies()); status != http.StatusOK || out["access_token"] == nil {
		t.Fatalf("trade the oauth session: %d %v", status, out)
	}

	if status, out := call(http.MethodGet, "/api/v1/me/security", token, nil); status != http.StatusOK || data(out)["has_password"] != true || data(out)["has_google"] != false || data(out)["totp_enabled"] != false {
		t.Fatalf("security: %d %v", status, out)
	}

	// Profile: the change reaches the public mirror through Authula's hooks.
	if status, _ := call(http.MethodPatch, "/api/v1/me", token, map[string]string{"name": "Renamed", "image": "http://example.com/a.png"}); status != http.StatusUnprocessableEntity {
		t.Fatalf("http avatar: %d, want 422", status)
	}
	if status, out := call(http.MethodPatch, "/api/v1/me", token, map[string]string{"name": "Renamed", "image": "https://example.com/a.png"}); status != http.StatusOK || data(out)["name"] != "Renamed" {
		t.Fatalf("update profile: %d %v", status, out)
	}
	var name, image string
	if err := db.QueryRow(`SELECT name, image FROM public.users WHERE email = $1`, email).Scan(&name, &image); err != nil || name != "Renamed" || image != "https://example.com/a.png" {
		t.Fatalf("mirror after update: %q %q %v", name, image, err)
	}
	// The timezone is checked against the zone database and kept in the
	// user's metadata; leaving it out keeps it.
	if status, _ := call(http.MethodPatch, "/api/v1/me", token, map[string]string{"name": "Renamed", "timezone": "Mars/Olympus"}); status != http.StatusBadRequest {
		t.Fatalf("unknown timezone: %d, want 400", status)
	}
	if status, out := call(http.MethodPatch, "/api/v1/me", token, map[string]string{"name": "Renamed", "timezone": "Asia/Jakarta"}); status != http.StatusOK || data(out)["metadata"].(map[string]any)["timezone"] != "Asia/Jakarta" {
		t.Fatalf("set timezone: %d %v", status, out)
	}
	if _, out := call(http.MethodPatch, "/api/v1/me", token, map[string]string{"name": "Renamed again"}); data(out)["metadata"].(map[string]any)["timezone"] != "Asia/Jakarta" {
		t.Fatalf("a profile save without a timezone dropped it: %v", data(out))
	}
	// A preference leaves the avatar and the timezone alone, and a profile save leaves it.
	if status, _ := call(http.MethodPatch, "/api/v1/me", token, map[string]string{"name": "Renamed again", "image": "https://example.com/a.png"}); status != http.StatusOK {
		t.Fatalf("set avatar: %d", status)
	}
	if status, out := call(http.MethodPatch, "/api/v1/me/preferences", token, map[string]any{"split_inbox": true}); status != http.StatusOK || data(out)["metadata"].(map[string]any)["split_inbox"] != true || data(out)["metadata"].(map[string]any)["timezone"] != "Asia/Jakarta" || data(out)["image"] != "https://example.com/a.png" {
		t.Fatalf("set split inbox: %d %v", status, out)
	}
	if _, out := call(http.MethodPatch, "/api/v1/me", token, map[string]string{"name": "Renamed again"}); data(out)["metadata"].(map[string]any)["split_inbox"] != true {
		t.Fatalf("a profile save dropped split inbox: %v", data(out))
	}

	// Two-factor: enabling waits for a first code, so a botched scan locks no one out.
	status, out = call(http.MethodPost, "/api/v1/auth/totp/enable", token, map[string]any{})
	if status != http.StatusOK || out["totp_uri"] == nil || len(out["backup_codes"].([]any)) == 0 {
		t.Fatalf("enable totp: %d %v", status, out)
	}
	pending := cookies()
	uri, _ := url.Parse(out["totp_uri"].(string))
	backupCode := out["backup_codes"].([]any)[0].(string)
	code, err := totpservices.NewTOTPService(6, 30).GenerateCode(uri.Query().Get("secret"), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if status, out := call(http.MethodGet, "/api/v1/me/security", token, nil); status != http.StatusOK || data(out)["totp_enabled"] != false {
		t.Fatalf("totp before the first code: %d %v", status, out)
	}
	if status, _ := call(http.MethodPost, "/api/v1/auth/totp/verify", "", map[string]string{"code": "000000"}, "Cookie", pending); status != http.StatusUnauthorized {
		t.Fatalf("wrong first code: %d, want 401", status)
	}
	if status, out := call(http.MethodPost, "/api/v1/auth/totp/verify", "", map[string]string{"code": code}, "Cookie", pending); status != http.StatusOK || out["access_token"] == nil {
		t.Fatalf("confirm totp: %d %v", status, out)
	}
	if status, out := call(http.MethodGet, "/api/v1/me/security", token, nil); status != http.StatusOK || data(out)["totp_enabled"] != true {
		t.Fatalf("totp after the first code: %d %v", status, out)
	}

	// An OAuth2 callback goes no further than the second step either.
	if status, out := call(http.MethodGet, oauthCallback, "", nil); status != http.StatusFound || strings.Contains(cookies(), config.SessionCookieName+"=") {
		t.Fatalf("oauth callback with totp: %d %v, cookies %q", status, out, cookies())
	}

	// Now a password alone gets no tokens, only the second step.
	status, out = signIn(password)
	if status != http.StatusOK || out["totp_redirect"] != true || out["access_token"] != nil {
		t.Fatalf("sign in with totp: %d %v", status, out)
	}
	pending = cookies()
	if status, out := call(http.MethodPost, "/api/v1/auth/totp/verify-backup-code", "", map[string]any{"code": backupCode}, "Cookie", pending); status != http.StatusOK || out["access_token"] == nil {
		t.Fatalf("backup code: %d %v", status, out)
	}

	// Password: the current one is checked, and the change ends every session.
	if status, _ := call(http.MethodPut, "/api/v1/me/password", token, map[string]string{"current_password": "wrong-password", "new_password": "a-new-password"}); status != http.StatusBadRequest {
		t.Fatalf("wrong current password: %d, want 400", status)
	}
	if status, _ := call(http.MethodPut, "/api/v1/me/password", token, map[string]string{"current_password": password, "new_password": "short"}); status != http.StatusBadRequest {
		t.Fatalf("short new password: %d, want 400", status)
	}
	// An API key made before the change, which the change must revoke.
	_, out = call(http.MethodPost, "/api/v1/me/api-keys", token, map[string]any{"name": "Before the change"})
	key, _ := data(out)["key"].(string)
	if status, _ := mcpRPC(call, key, "tools/list", nil); status != http.StatusOK {
		t.Fatalf("new key on /mcp: %d, want 200", status)
	}
	if status, out := call(http.MethodPut, "/api/v1/me/password", token, map[string]string{"current_password": password, "new_password": "a-new-password"}); status != http.StatusOK {
		t.Fatalf("change password: %d %v", status, out)
	}
	if status, _ := mcpRPC(call, key, "tools/list", nil); status != http.StatusUnauthorized {
		t.Fatalf("API key after the change: %d, want 401", status)
	}
	if status, _ := call(http.MethodGet, "/api/v1/me/security", token, nil); status != http.StatusUnauthorized {
		t.Fatalf("old token after the change: %d, want 401", status)
	}
	if status, _ := signIn(password); status != http.StatusUnauthorized {
		t.Fatalf("old password after the change: %d, want 401", status)
	}
	if status, out := signIn("a-new-password"); status != http.StatusOK || out["totp_redirect"] != true {
		t.Fatalf("new password: %d %v", status, out)
	}
}
