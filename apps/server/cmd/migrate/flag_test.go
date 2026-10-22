package main

import "testing"

func TestIsLocalDSN(t *testing.T) {
	cases := map[string]bool{
		"postgres://u:p@localhost:5432/montara_mail_agent?sslmode=disable": true,
		"postgres://u:p@127.0.0.1/montara_mail_agent":                      true,
		"postgres://u:p@[::1]:5432/montara_mail_agent":                     true,
		"postgres://u:p@db.example.com:5432/montara_mail_agent":            false,
		"postgres://u:p@localhost.evil.com/montara_mail_agent":             false,
		"host=localhost dbname=montara_mail_agent":                         false,
		"": false,
	}
	for dsn, want := range cases {
		if got := isLocalDSN(dsn); got != want {
			t.Errorf("isLocalDSN(%q) = %v, want %v", dsn, got, want)
		}
	}
}
