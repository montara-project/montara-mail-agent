package main

import (
	"testing"

	"montara-mail-agent/server/internal/seeders"
)

func TestAuthDSN(t *testing.T) {
	cases := map[string]string{
		"postgres://u:p@localhost:5432/montara_mail_agent?sslmode=disable": "postgres://u:p@localhost:5432/montara_mail_agent?search_path=authula&sslmode=disable",
		"postgres://u:p@localhost:5432/montara_mail_agent":                 "postgres://u:p@localhost:5432/montara_mail_agent?search_path=authula",
		"host=localhost dbname=montara_mail_agent":                         "host=localhost dbname=montara_mail_agent search_path=authula",
	}
	for dsn, want := range cases {
		if got := authDSN(dsn); got != want {
			t.Errorf("authDSN(%q) = %q, want %q", dsn, got, want)
		}
	}
}

func TestValidateSuperUser(t *testing.T) {
	cases := []struct {
		email, password string
		ok              bool
	}{
		{"admin@mail.com", "a-long-enough-password", true},
		{"admin@mail.com", "admin123", false},
		{"admin@mail.com", "", false},
		{"not-an-email", "a-long-enough-password", false},
		{"", "a-long-enough-password", false},
	}
	for _, c := range cases {
		if err := seeders.ValidateSuperUser(c.email, c.password); (err == nil) != c.ok {
			t.Errorf("ValidateSuperUser(%q, %q) = %v, want ok=%v", c.email, c.password, err, c.ok)
		}
	}
}
