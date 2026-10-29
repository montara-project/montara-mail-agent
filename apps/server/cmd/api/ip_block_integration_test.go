package main

import (
	"fmt"
	"net/http"
	"testing"

	"montara-mail-agent/server/internal/ipblock"
)

// testIPBlocks covers the IP Block page's API: only a super user manages
// blocks, a block refuses its addresses on every route until it is lifted,
// the caller cannot block themselves, and failed sign-ins block on their own.
// The test's own address (0.0.0.0) is exempt; the clients under test arrive
// through the trusted proxy with X-Forwarded-For.
func testIPBlocks(t *testing.T, call callFunc, userToken, superToken string) {
	t.Helper()
	from := func(ip string) []string { return []string{"X-Forwarded-For", ip} }

	if status, _ := call(http.MethodGet, "/api/v1/ip-blocks", userToken, nil); status != http.StatusForbidden {
		t.Fatalf("IP blocks as a plain user: %d, want 403", status)
	}
	if status, out := call(http.MethodGet, "/api/v1/me/security", superToken, nil); status != http.StatusOK || data(out)["super_user"] != true {
		t.Fatalf("security of a super user: %d %v", status, out)
	}

	for _, bad := range []string{"nope", "10.0.0.0/4", "0.0.0.0"} {
		if status, out := call(http.MethodPost, "/api/v1/ip-blocks", superToken, map[string]any{"address": bad}); status != http.StatusBadRequest {
			t.Fatalf("block %q: %d %v, want 400", bad, status, out)
		}
	}

	status, out := call(http.MethodPost, "/api/v1/ip-blocks", superToken, map[string]any{"address": "198.51.100.0/24", "reason": "scraping", "expires_in_hours": 24})
	if status != http.StatusCreated || data(out)["source"] != "manual" || data(out)["network"] != "198.51.100.0/24" || data(out)["expires_at"] == nil {
		t.Fatalf("block a range: %d %v", status, out)
	}
	manualID := data(out)["id"].(string)
	if status, _ := call(http.MethodGet, "/health", "", nil, from("198.51.100.77")...); status != http.StatusForbidden {
		t.Fatalf("blocked address on /health: %d, want 403", status)
	}
	if status, _ := call(http.MethodGet, "/health", "", nil, from("198.51.101.1")...); status != http.StatusOK {
		t.Fatalf("address outside the range: %d, want 200", status)
	}
	if status, _ := call(http.MethodDelete, "/api/v1/ip-blocks/"+manualID, superToken, nil); status != http.StatusOK {
		t.Fatalf("unblock: %d", status)
	}
	if status, _ := call(http.MethodGet, "/health", "", nil, from("198.51.100.77")...); status != http.StatusOK {
		t.Fatalf("unblocked address: %d, want 200", status)
	}

	// Failed sign-ins block the address on their own, for a limited time.
	const attacker = "192.0.2.50"
	for i := range ipblock.FailedSignInLimit {
		status, _ = call(http.MethodPost, "/api/v1/auth/email-password/sign-in", "", map[string]string{"email": "nobody@example.com", "password": fmt.Sprint("wrong-", i)}, from(attacker)...)
		if status != http.StatusUnauthorized {
			t.Fatalf("failed sign-in %d: %d, want 401", i+1, status)
		}
	}
	if status, _ := call(http.MethodGet, "/health", "", nil, from(attacker)...); status != http.StatusForbidden {
		t.Fatalf("after %d failed sign-ins: %d, want 403", ipblock.FailedSignInLimit, status)
	}
	_, out = call(http.MethodGet, "/api/v1/ip-blocks", superToken, nil)
	var autoID string
	for _, raw := range list(out) {
		b := raw.(map[string]any)
		if b["network"] == attacker+"/32" && b["source"] == "auto" && b["expires_at"] != nil {
			autoID = b["id"].(string)
		}
	}
	if autoID == "" {
		t.Fatalf("no automatic block for %s: %v", attacker, out)
	}
	if status, _ := call(http.MethodDelete, "/api/v1/ip-blocks/"+autoID, superToken, nil); status != http.StatusOK {
		t.Fatalf("lift the automatic block: %d", status)
	}
	if status, _ := call(http.MethodGet, "/health", "", nil, from(attacker)...); status != http.StatusOK {
		t.Fatalf("after lifting the automatic block: %d, want 200", status)
	}
}
