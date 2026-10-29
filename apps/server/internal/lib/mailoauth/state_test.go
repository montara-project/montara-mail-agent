package mailoauth

import (
	"strings"
	"testing"
)

// stateSecret stands in for the app secret.
const stateSecret = "test-secret-at-least-32-characters-long!!"

func TestSignStateRoundTrip(t *testing.T) {
	want := State{OrganizationID: "org-1", Provider: "gmail", Origin: "http://localhost:3000", Verifier: "pkce-verifier"}

	signed, err := SignState(stateSecret, want)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	got, err := VerifyState(stateSecret, signed)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if got.OrganizationID != want.OrganizationID || got.Provider != want.Provider || got.Origin != want.Origin || got.Verifier != want.Verifier {
		t.Fatalf("round trip changed the state: %+v", got)
	}
	if got.Exp == 0 {
		t.Fatal("SignState set no expiry")
	}
}

func TestVerifyStateRejectsTampering(t *testing.T) {
	signed, err := SignState(stateSecret, State{OrganizationID: "org-1", Provider: "gmail", Origin: "http://localhost:3000"})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	// A sealed state with one byte flipped.
	raw, _ := encoding.DecodeString(signed)
	raw[len(raw)-1] ^= 1
	if _, err := VerifyState(stateSecret, encoding.EncodeToString(raw)); err == nil {
		t.Fatal("a tampered state was accepted")
	}
	// The verifier is not readable in the sealed state.
	withVerifier, _ := SignState(stateSecret, State{Verifier: "pkce-secret-verifier"})
	decoded, _ := encoding.DecodeString(withVerifier)
	if strings.Contains(string(decoded), "pkce-secret-verifier") {
		t.Fatal("the verifier is readable in the state")
	}
	// A different secret's signature.
	other, err := SignState("another-secret-also-at-least-32-chars!!", State{OrganizationID: "org-1"})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if _, err := VerifyState(stateSecret, other); err == nil {
		t.Fatal("a state signed with another secret was accepted")
	}
	// Garbage.
	for _, broken := range []string{"", "no-signature", "a.b"} {
		if _, err := VerifyState(stateSecret, broken); err == nil {
			t.Fatalf("malformed state %q was accepted", broken)
		}
	}
}
