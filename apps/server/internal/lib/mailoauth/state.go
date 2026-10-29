package mailoauth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"
)

// The state binds a consent redirect to the flow that started it: which
// organization and provider it is for, which web app to return to, who
// started it, and which PKCE verifier completes the exchange. It is sealed
// (AES-256-GCM) with a key derived from the app secret and short-lived, so a
// provider callback the server never began, or one replayed after its
// window, is refused, nothing has to be stored between the two browser
// visits, and the verifier stays secret although the state rides in URLs:
// a code seen in a log or browser history can't be redeemed without it.

// stateTTL is how long a started flow may be finished.
const stateTTL = 10 * time.Minute

// State is the sealed payload a consent URL carries and the callback opens.
type State struct {
	OrganizationID string `json:"organization_id"`
	Provider       string `json:"provider"`
	// Origin is the web app's origin the browser returns to; the API learns
	// it from the request that started the flow, among the allowed origins.
	Origin string `json:"origin"`
	// UserID is the member who started the flow: only they may finish it.
	UserID   string `json:"user_id,omitempty"`
	Verifier string `json:"verifier,omitempty"`
	Exp      int64  `json:"exp"`
}

var (
	// encoding keeps the state URL-safe.
	encoding = base64.RawURLEncoding
	// stateKeyDomain keeps the sealing key apart from the other uses of the
	// app secret (token signing, SecretBox).
	stateKeyDomain = "montara-mail-agent/mailoauth/state:"
)

func stateAEAD(secret string) (cipher.AEAD, error) {
	key := sha256.Sum256([]byte(stateKeyDomain + secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

// SignState seals s with its expiry set.
func SignState(secret string, s State) (string, error) {
	s.Exp = time.Now().Add(stateTTL).Unix()
	payload, err := json.Marshal(s)
	if err != nil {
		return "", err
	}
	aead, err := stateAEAD(secret)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return encoding.EncodeToString(aead.Seal(nonce, nonce, payload, nil)), nil
}

// VerifyState opens a state a provider's callback carried and checks its
// expiry.
func VerifyState(secret, sealed string) (State, error) {
	var s State
	raw, err := encoding.DecodeString(sealed)
	if err != nil {
		return s, errors.New("malformed state")
	}
	aead, err := stateAEAD(secret)
	if err != nil {
		return s, err
	}
	if len(raw) < aead.NonceSize() {
		return s, errors.New("malformed state")
	}
	payload, err := aead.Open(nil, raw[:aead.NonceSize()], raw[aead.NonceSize():], nil)
	if err != nil {
		return s, errors.New("the state doesn't match this server")
	}
	if err := json.Unmarshal(payload, &s); err != nil {
		return s, errors.New("malformed state")
	}
	if time.Now().Unix() > s.Exp {
		return s, errors.New("the sign-in attempt expired")
	}
	return s, nil
}
