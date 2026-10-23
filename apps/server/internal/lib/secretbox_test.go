package lib

import (
	"net/netip"
	"testing"
)

func TestSecretBox(t *testing.T) {
	box, _ := NewSecretBox("0123456789abcdef0123456789abcdef")
	sealed := box.Seal("app-password")
	if got, err := box.Open(sealed); err != nil || got != "app-password" {
		t.Fatalf("Open = %q, %v", got, err)
	}
	if string(box.Seal("app-password")) == string(sealed) {
		t.Fatal("two seals of the same value are equal: the nonce is not random")
	}

	other, _ := NewSecretBox("another-secret-another-secret-xx")
	if _, err := other.Open(sealed); err == nil {
		t.Fatal("a value sealed with another secret opened")
	}
	if _, err := box.Open([]byte("short")); err == nil {
		t.Fatal("a truncated value opened")
	}
}

func TestPublicAddr(t *testing.T) {
	for addr, want := range map[string]bool{
		"142.250.4.108":   true,
		"2607:f8b0::200e": true,
		"127.0.0.1":       false,
		"10.0.0.5":        false,
		"192.168.1.1":     false,
		"169.254.169.254": false,
		"100.100.1.1":     false,
		"0.0.0.0":         false,
		"::1":             false,
		"::ffff:10.0.0.1": false,
	} {
		if got := PublicAddr(netip.MustParseAddr(addr)); got != want {
			t.Errorf("PublicAddr(%s) = %v, want %v", addr, got, want)
		}
	}
}
