package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/apperr"
)

// testLLMProviderScope walks the platform provider and moving a provider
// between an organization and platform: only a super user touches the platform
// one, an organization's own wins over it, and a scope holds one provider.
func testLLMProviderScope(t *testing.T, call callFunc, application *app.Application, userToken, superToken, userOrg string) {
	t.Helper()

	orgID := uuid.MustParse(userOrg)
	inUse := func() string {
		t.Helper()
		p, err := application.Repositories.LLMProvider.ForOrganization(context.Background(), orgID)
		if apperr.IsNotFound(err) {
			return ""
		}
		if err != nil {
			t.Fatal(err)
		}
		return p.Model
	}
	provider := func(name, model string) map[string]any {
		return map[string]any{"name": name, "kind": "openai", "model": model, "api_key": "sk-x", "base_url": "https://llm.example.com/v1"}
	}
	const platform = "/api/v1/llm-providers/platform"
	own := "/api/v1/organizations/" + userOrg + "/llm-provider"

	if status, _ := call(http.MethodPut, platform, userToken, provider("Platform", "gpt-platform")); status != http.StatusForbidden {
		t.Fatalf("owner sets the platform provider: %d, want 403", status)
	}
	status, out := call(http.MethodPut, platform, superToken, provider("Platform", "gpt-platform"))
	if status != http.StatusOK || data(out)["organization_id"] != nil || data(out)["name"] != "Platform" {
		t.Fatalf("super user sets the platform provider: %d %v", status, out)
	}
	platformID := data(out)["id"].(string)
	if got := inUse(); got != "gpt-platform" {
		t.Fatalf("organization without its own uses %q, want the platform one", got)
	}

	status, out = call(http.MethodPut, own, userToken, provider("Own", "gpt-own"))
	if status != http.StatusOK {
		t.Fatalf("owner sets the organization's provider: %d %v", status, out)
	}
	ownID := data(out)["id"].(string)
	if got := inUse(); got != "gpt-own" {
		t.Fatalf("organization with its own uses %q, want gpt-own", got)
	}

	status, out = call(http.MethodGet, "/api/v1/llm-providers", userToken, nil)
	list, _ := out["data"].([]any)
	if status != http.StatusOK || len(list) != 2 || out["metadata"].(map[string]any)["super_user"] != false {
		t.Fatalf("owner lists providers: %d %v", status, out)
	}
	if first := list[0].(map[string]any); first["id"] != platformID || list[1].(map[string]any)["organization_name"] == "" {
		t.Fatalf("list order or organization name: %v", list)
	}

	scopePath := func(id string) string { return "/api/v1/llm-providers/" + id + "/scope" }
	if status, _ := call(http.MethodPut, scopePath(ownID), userToken, map[string]any{}); status != http.StatusForbidden {
		t.Fatalf("owner moves a provider to platform: %d, want 403", status)
	}
	if status, _ := call(http.MethodPut, scopePath(platformID), superToken, map[string]any{"organization_id": userOrg}); status != http.StatusConflict {
		t.Fatalf("move into an organization that has one: %d, want 409", status)
	}
	if status, out := call(http.MethodDelete, own, userToken, nil); status != http.StatusOK {
		t.Fatalf("remove the organization's provider: %d %v", status, out)
	}
	if status, out := call(http.MethodPut, scopePath(platformID), superToken, map[string]any{"organization_id": userOrg}); status != http.StatusOK || data(out)["organization_id"] != userOrg {
		t.Fatalf("move platform to the organization: %d %v", status, out)
	}
	if status, out := call(http.MethodPut, scopePath(platformID), superToken, map[string]any{"organization_id": ""}); status != http.StatusOK || data(out)["organization_id"] != nil {
		t.Fatalf("move it back to platform: %d %v", status, out)
	}

	// The later flows count on the server's fallback model again.
	if status, out := call(http.MethodDelete, platform, superToken, nil); status != http.StatusOK {
		t.Fatalf("remove the platform provider: %d %v", status, out)
	}
	if got := inUse(); got != "" {
		t.Fatalf("after removing both, the organization uses %q", got)
	}
}
