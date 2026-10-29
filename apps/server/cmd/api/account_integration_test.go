package main

import (
	"database/sql"
	"net/http"
	"net/url"
	"testing"
	"time"

	totpservices "github.com/Authula/authula/plugins/totp/services"
)

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

	if status, out := call(http.MethodGet, "/api/v1/me/security", token, nil); status != http.StatusOK || data(out)["has_password"] != true || data(out)["totp_enabled"] != false {
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
