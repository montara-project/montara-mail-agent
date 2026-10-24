package mailoauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// The state binds a consent redirect to the flow that started it: which
// organization and provider it is for, which web app to return to, and which
// PKCE verifier completes the exchange. It is HMAC-signed with the app
// secret and short-lived, so a provider callback the server never began —
// or one replayed after its minute — is refused, and nothing has to be
// stored between the two browser visits.

// stateTTL is how long a started flow may be finished.
const stateTTL = 10 * time.Minute

// State is the signed payload a consent URL carries and the callback
// verifies.
type State struct {
	OrganizationID string `json:"organization_id"`
	Provider       string `json:"provider"`
	// Origin is the web app's origin the browser returns to; the API learns
	// it from the request that started the flow.
	Origin   string `json:"origin"`
	Verifier string `json:"verifier,omitempty"`
	Exp      int64  `json:"exp"`
}

var (
	// encoding keeps the two state segments free of the "." separator.
	encoding = base64.RawURLEncoding
	// stateKeyDomain keeps the signing key apart from the other uses of the
	// app secret (token signing, SecretBox).
	stateKeyDomain = "montara-mail-agent/mailoauth/state:"
)

// SignState seals s with its expiry set, returning payload.signature.
func SignState(secret string, s State) (string, error) {
	s.Exp = time.Now().Add(stateTTL).Unix()
	payload, err := json.Marshal(s)
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, []byte(stateKeyDomain+secret))
	mac.Write(payload)
	return encoding.EncodeToString(payload) + "." + encoding.EncodeToString(mac.Sum(nil)), nil
}

// VerifyState checks the signature and expiry of a state a provider's
// callback carried.
func VerifyState(secret, signed string) (State, error) {
	var s State
	payload, sig, ok := strings.Cut(signed, ".")
	if !ok {
		return s, errors.New("malformed state")
	}
	raw, err := encoding.DecodeString(payload)
	if err != nil {
		return s, errors.New("malformed state")
	}
	want, err := encoding.DecodeString(sig)
	if err != nil {
		return s, errors.New("malformed state")
	}
	mac := hmac.New(sha256.New, []byte(stateKeyDomain+secret))
	mac.Write(raw)
	if !hmac.Equal(want, mac.Sum(nil)) {
		return s, errors.New("the state doesn't match this server")
	}
	if err := json.Unmarshal(raw, &s); err != nil {
		return s, errors.New("malformed state")
	}
	if time.Now().Unix() > s.Exp {
		return s, errors.New("the sign-in attempt expired")
	}
	return s, nil
}
