package main

import (
	"net/http"
	"testing"
	"time"
)

// testActivityLogs walks the activity log endpoints: the user's own entries,
// their organization's, the pagination metadata, and who may not read them.
// It runs while userToken is still valid, so it asserts on the actions the
// flow recorded up to then: sign-ins, and the organization created and
// renamed above.
func testActivityLogs(t *testing.T, call callFunc, userToken, superToken, userOrg, superOrg, userEmail string) {
	t.Helper()

	status, out := call(http.MethodGet, "/api/v1/me/activity-logs", userToken, nil)
	if status != http.StatusOK {
		t.Fatalf("list own activities: %d %v", status, out)
	}
	entries := out["data"].([]any)
	if len(entries) == 0 {
		t.Fatal("own activities: none recorded")
	}
	actions := map[string]bool{}
	for _, e := range entries {
		entry := e.(map[string]any)
		actions[entry["action"].(string)] = true
		if entry["actor_email"].(string) != userEmail {
			t.Fatalf("own activities carry another actor: %v", entry)
		}
	}
	for _, want := range []string{"auth.sign_in", "organization.created", "organization.updated"} {
		if !actions[want] {
			t.Fatalf("own activities miss %q: %v", want, actions)
		}
	}

	// Newest first.
	parseAt := func(raw any) time.Time {
		at, err := time.Parse(time.RFC3339, raw.(string))
		if err != nil {
			t.Fatalf("created_at %v: %v", raw, err)
		}
		return at
	}
	if parseAt(entries[0].(map[string]any)["created_at"]).Before(parseAt(entries[len(entries)-1].(map[string]any)["created_at"])) {
		t.Fatal("own activities are not newest first")
	}

	// The organization's log tells its history, naming it.
	status, out = call(http.MethodGet, "/api/v1/organizations/"+userOrg+"/activity-logs", userToken, nil)
	if status != http.StatusOK {
		t.Fatalf("list organization activities: %d %v", status, out)
	}
	orgEntries := out["data"].([]any)
	if len(orgEntries) == 0 || orgEntries[len(orgEntries)-1].(map[string]any)["description"] != `Created the organization "User Org"` {
		t.Fatalf("organization activities: %v", orgEntries)
	}

	// A super user reads an organization's log without belonging to it.
	if status, _ := call(http.MethodGet, "/api/v1/organizations/"+userOrg+"/activity-logs", superToken, nil); status != http.StatusOK {
		t.Fatalf("super user reads organization activities: %d, want 200", status)
	}
	// A non-member learns nothing, as with the organization itself.
	if status, _ := call(http.MethodGet, "/api/v1/organizations/"+superOrg+"/activity-logs", userToken, nil); status != http.StatusNotFound {
		t.Fatalf("non-member reads organization activities: %d, want 404", status)
	}

	// The metadata carries the full count while the page holds one entry.
	status, out = call(http.MethodGet, "/api/v1/me/activity-logs?limit=1", userToken, nil)
	if status != http.StatusOK {
		t.Fatalf("paged activities: %d %v", status, out)
	}
	if page := out["data"].([]any); len(page) != 1 {
		t.Fatalf("paged activities: %d entries, want 1", len(page))
	}
	meta := out["metadata"].(map[string]any)
	if total := int(meta["total"].(float64)); total < len(entries) {
		t.Fatalf("paged total %d, want at least %d", total, len(entries))
	}

	// A search that matches nothing answers an empty page, not an error.
	status, out = call(http.MethodGet, "/api/v1/me/activity-logs?search=zzz-no-such-action", userToken, nil)
	if status != http.StatusOK || len(out["data"].([]any)) != 0 {
		t.Fatalf("search activities: %d %v, want an empty page", status, out)
	}
}
