package main

import (
	"net/http"
	"testing"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/mailoauth"
)

// testOAuthFinish: the provider's callback only hands the code back; finishing
// the connection is the signed-in user's own call, refused for a flow someone
// else started (a consent link sent to a victim) and for a tampered state.
func testOAuthFinish(t *testing.T, call callFunc, application *app.Application, userToken, userOrg string) {
	t.Helper()
	secret := application.Config.App.Secret

	theirs, err := mailoauth.SignState(secret, mailoauth.State{OrganizationID: userOrg, Provider: "gmail", Origin: "http://localhost:3000", UserID: uuid.NewString(), Verifier: "v"})
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/api/v1/email-accounts/oauth/gmail/finish", "/api/v1/mcp-servers/oauth/finish"} {
		state := theirs
		if path == "/api/v1/mcp-servers/oauth/finish" {
			if state, err = mailoauth.SignState(secret, mailoauth.State{OrganizationID: userOrg, Provider: "mcp:" + uuid.NewString(), UserID: uuid.NewString()}); err != nil {
				t.Fatal(err)
			}
		}
		if status, out := call(http.MethodPost, path, userToken, map[string]string{"code": "c", "state": state}); status != http.StatusForbidden {
			t.Fatalf("%s with someone else's flow: %d %v, want 403", path, status, out)
		}
		if status, _ := call(http.MethodPost, path, userToken, map[string]string{"code": "c", "state": state + "x"}); status != http.StatusBadRequest {
			t.Fatalf("%s with a tampered state: %d, want 400", path, status)
		}
	}
	// The callback itself saves nothing: it sends the browser back to the web
	// app with the code, for the signed-in user to finish.
	if status, _ := call(http.MethodGet, "/api/v1/email-accounts/oauth/gmail/callback?code=abc&state="+theirs, "", nil); status < 300 || status > 399 {
		t.Fatalf("callback: %d, want a redirect", status)
	}
}
