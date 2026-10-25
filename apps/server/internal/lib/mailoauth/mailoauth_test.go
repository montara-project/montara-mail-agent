package mailoauth

import (
	"strings"
	"testing"

	"montara-mail-agent/server/internal/lib/constant"
)

// Yahoo reads a literal "+" in the query instead of a space, so the consent
// URL's scopes must be %-encoded.
func TestConsentURLEncodesScopeSpaces(t *testing.T) {
	p, ok := Get(constant.ProviderYahoo)
	if !ok {
		t.Fatal("yahoo is not registered")
	}
	url := p.ConsentURL(Credentials{ClientID: "id", ClientSecret: "secret"}, "https://api.example.com/cb", "signed-state", "")
	if strings.Contains(url, "+") {
		t.Fatalf("consent URL carries a literal plus: %s", url)
	}
	if !strings.Contains(url, "scope=mail-r%20mail-w%20openid%20profile%20email") {
		t.Fatalf("scopes are not space-encoded: %s", url)
	}
	if !strings.Contains(url, "state=signed-state") {
		t.Fatalf("state is missing: %s", url)
	}
}
