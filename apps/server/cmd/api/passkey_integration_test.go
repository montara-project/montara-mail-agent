package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"net/http"
	"testing"

	authula "github.com/Authula/authula"
	"github.com/fxamacker/cbor/v2"
)

// testOrigin is where the test's web app runs: the API's own origin, since
// the test config sets no CORS origins.
const testOrigin = "http://localhost:8080"

var b64 = base64.RawURLEncoding

// authenticator is a software passkey: one P-256 key for one site.
type authenticator struct {
	key    *ecdsa.PrivateKey
	id     []byte
	handle []byte
	count  uint32
}

func (a *authenticator) authData(rpID string, flags byte, attested []byte) []byte {
	rp := sha256.Sum256([]byte(rpID))
	out := append(rp[:], flags)
	out = binary.BigEndian.AppendUint32(out, a.count)
	return append(out, attested...)
}

func clientData(kind, challenge string) []byte {
	raw, _ := json.Marshal(map[string]any{"type": kind, "challenge": challenge, "origin": testOrigin, "crossOrigin": false})
	return raw
}

// create answers navigator.credentials.create with "none" attestation.
func (a *authenticator) create(t *testing.T, options map[string]any) map[string]any {
	t.Helper()
	pk := options["publicKey"].(map[string]any)
	handle, err := b64.DecodeString(pk["user"].(map[string]any)["id"].(string))
	if err != nil {
		t.Fatal(err)
	}
	a.handle = handle

	x, y := a.key.X.FillBytes(make([]byte, 32)), a.key.Y.FillBytes(make([]byte, 32))
	cose, _ := cbor.Marshal(map[int]any{1: 2, 3: -7, -1: 1, -2: x, -3: y})
	attested := make([]byte, 16) // zero AAGUID
	attested = binary.BigEndian.AppendUint16(attested, uint16(len(a.id)))
	attested = append(append(attested, a.id...), cose...)
	// User present, user verified, attested credential data.
	object, _ := cbor.Marshal(map[string]any{
		"fmt": "none", "attStmt": map[string]any{},
		"authData": a.authData(pk["rp"].(map[string]any)["id"].(string), 0x01|0x04|0x40, attested),
	})
	return map[string]any{
		"id": b64.EncodeToString(a.id), "rawId": b64.EncodeToString(a.id), "type": "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64.EncodeToString(clientData("webauthn.create", pk["challenge"].(string))),
			"attestationObject": b64.EncodeToString(object),
		},
	}
}

// get answers navigator.credentials.get with a signed assertion. Without
// verified, the authenticator reports the user present but not verified.
func (a *authenticator) get(t *testing.T, options map[string]any, verified bool) map[string]any {
	t.Helper()
	pk := options["publicKey"].(map[string]any)
	a.count++
	flags := byte(0x01)
	if verified {
		flags |= 0x04
	}
	data := a.authData(pk["rpId"].(string), flags, nil)
	client := clientData("webauthn.get", pk["challenge"].(string))
	hash := sha256.Sum256(client)
	digest := sha256.Sum256(append(append([]byte{}, data...), hash[:]...))
	sig, err := ecdsa.SignASN1(rand.Reader, a.key, digest[:])
	if err != nil {
		t.Fatal(err)
	}
	return map[string]any{
		"id": b64.EncodeToString(a.id), "rawId": b64.EncodeToString(a.id), "type": "public-key",
		"response": map[string]any{
			"clientDataJSON":    b64.EncodeToString(client),
			"authenticatorData": b64.EncodeToString(data),
			"signature":         b64.EncodeToString(sig),
			"userHandle":        b64.EncodeToString(a.handle),
		},
	}
}

// registerPasskey adds a new software passkey, with its own credential id, to
// the user of token, confirming with their password.
func registerPasskey(t *testing.T, call callFunc, token, password string) *authenticator {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		t.Fatal(err)
	}
	a := &authenticator{key: key, id: id}

	status, out := call(http.MethodPost, "/api/v1/me/passkeys/options", token, map[string]string{"password": password})
	if status != http.StatusOK {
		t.Fatalf("passkey options: %d %v", status, out)
	}
	credential := a.create(t, data(out))
	if status, out := call(http.MethodPost, "/api/v1/me/passkeys", token, map[string]any{"name": "Test key", "credential": credential}); status != http.StatusCreated || data(out)["name"] != "Test key" {
		t.Fatalf("add passkey: %d %v", status, out)
	}
	// The challenge went with it.
	if status, _ := call(http.MethodPost, "/api/v1/me/passkeys", token, map[string]any{"credential": credential}); status != http.StatusBadRequest {
		t.Fatalf("passkey registration replayed: %d, want 400", status)
	}
	return a
}

// passkeySignIn signs in with a's passkey and returns the answer and the
// assertion it sent.
func passkeySignIn(t *testing.T, call callFunc, a *authenticator, verified bool) (int, map[string]any, map[string]any) {
	t.Helper()
	status, options := call(http.MethodPost, "/api/v1/auth/passkey/options", "", map[string]any{})
	if status != http.StatusOK {
		t.Fatalf("passkey sign-in options: %d %v", status, options)
	}
	assertion := a.get(t, options, verified)
	status, out := call(http.MethodPost, "/api/v1/auth/passkey/sign-in", "", assertion)
	return status, out, assertion
}

// testPasskeys registers a passkey, signs in with it, and removes it. Adding
// one takes the password, a challenge verifies once, an assertion without
// user verification is refused, and a removed passkey signs nobody in.
func testPasskeys(t *testing.T, call callFunc, token, password string) {
	t.Helper()
	for _, body := range []any{nil, map[string]string{"password": "wrong-password"}} {
		if status, _ := call(http.MethodPost, "/api/v1/me/passkeys/options", token, body); status != http.StatusBadRequest {
			t.Fatalf("passkey options with %v: %d, want 400", body, status)
		}
	}
	a := registerPasskey(t, call, token, password)
	status, out := call(http.MethodGet, "/api/v1/me/passkeys", token, nil)
	if keys := list(out); status != http.StatusOK || len(keys) != 1 {
		t.Fatalf("passkeys: %d %v", status, out)
	}
	id := list(out)[0].(map[string]any)["id"].(string)

	// Presence alone isn't enough: the key must have verified the user.
	if status, _, _ := passkeySignIn(t, call, a, false); status != http.StatusUnauthorized {
		t.Fatalf("passkey sign-in without user verification: %d, want 401", status)
	}

	status, out, assertion := passkeySignIn(t, call, a, true)
	if status != http.StatusOK || out["access_token"] == nil {
		t.Fatalf("passkey sign-in: %d %v", status, out)
	}
	if status, out := call(http.MethodGet, "/api/v1/me/passkeys", out["access_token"].(string), nil); status != http.StatusOK || list(out)[0].(map[string]any)["last_used_at"] == nil {
		t.Fatalf("passkey token or last use: %d %v", status, out)
	}
	if status, _ := call(http.MethodPost, "/api/v1/auth/passkey/sign-in", "", assertion); status != http.StatusUnauthorized {
		t.Fatalf("passkey sign-in replayed: %d, want 401", status)
	}

	if status, out := call(http.MethodDelete, "/api/v1/me/passkeys/"+id, token, nil); status != http.StatusOK {
		t.Fatalf("remove passkey: %d %v", status, out)
	}
	if status, _, _ := passkeySignIn(t, call, a, true); status != http.StatusUnauthorized {
		t.Fatalf("sign-in with a removed passkey: %d, want 401", status)
	}
}

// testRecentSignIn covers a user without a password, who signed in with
// Google, Microsoft or a magic link: they add a passkey or an authenticator
// app without one, but only within handlers.RecentSignIn of signing in.
func testRecentSignIn(t *testing.T, call callFunc, cookies func() string, auth *authula.Auth, db *sql.DB) {
	t.Helper()
	user, err := auth.CoreServices().UserService.Create(context.Background(), "Google User", "google-user@example.com", true, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	if status, out := call(http.MethodGet, "/api/v1/auth/oauth2/test-callback?user="+user.ID, "", nil); status != http.StatusFound {
		t.Fatalf("passwordless sign-in: %d %v", status, out)
	}
	status, out := call(http.MethodPost, "/api/v1/auth/token", "", nil, "Cookie", cookies())
	if status != http.StatusOK || out["access_token"] == nil {
		t.Fatalf("passwordless token: %d %v", status, out)
	}
	token := out["access_token"].(string)

	if status, out := call(http.MethodPost, "/api/v1/me/passkeys/options", token, map[string]any{}); status != http.StatusOK {
		t.Fatalf("passkey options right after sign-in: %d %v", status, out)
	}
	if status, out := call(http.MethodPost, "/api/v1/auth/totp/enable", token, map[string]any{}); status != http.StatusOK {
		t.Fatalf("totp enable right after sign-in: %d %v", status, out)
	}

	if _, err := db.Exec(`UPDATE authula.sessions SET created_at = now() - interval '11 minutes' WHERE user_id = $1`, user.ID); err != nil {
		t.Fatal(err)
	}
	if status, out := call(http.MethodPost, "/api/v1/me/passkeys/options", token, map[string]any{}); status != http.StatusForbidden {
		t.Fatalf("passkey options on an old session: %d %v, want 403", status, out)
	}
	if status, out := call(http.MethodPost, "/api/v1/auth/totp/enable", token, map[string]any{}); status != http.StatusForbidden {
		t.Fatalf("totp enable on an old session: %d %v, want 403", status, out)
	}
}
