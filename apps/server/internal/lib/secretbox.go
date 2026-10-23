package lib

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
)

// SecretBox seals credentials stored in the database (IMAP passwords, LLM
// API keys) with AES-256-GCM. The key is derived from the app secret, so
// rotating APP_SECRET makes every sealed value unreadable: the accounts and
// providers then have to be connected again.
type SecretBox struct {
	aead cipher.AEAD
}

// NewSecretBox derives the sealing key from secret. The label keeps this key
// apart from the token-signing use of the same secret.
func NewSecretBox(secret string) (*SecretBox, error) {
	key := sha256.Sum256([]byte("montara-mail-agent/secretbox:" + secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &SecretBox{aead: aead}, nil
}

// Seal encrypts plain, returning nonce || ciphertext.
func (b *SecretBox) Seal(plain string) []byte {
	nonce := make([]byte, b.aead.NonceSize(), b.aead.NonceSize()+len(plain)+b.aead.Overhead())
	// crypto/rand.Read never fails on supported platforms.
	_, _ = rand.Read(nonce)
	return b.aead.Seal(nonce, nonce, []byte(plain), nil)
}

var errSealed = errors.New("sealed value is corrupt or was sealed with another app secret")

// Open decrypts a value from Seal.
func (b *SecretBox) Open(sealed []byte) (string, error) {
	n := b.aead.NonceSize()
	if len(sealed) < n {
		return "", errSealed
	}
	plain, err := b.aead.Open(nil, sealed[:n], sealed[n:], nil)
	if err != nil {
		return "", errSealed
	}
	return string(plain), nil
}
