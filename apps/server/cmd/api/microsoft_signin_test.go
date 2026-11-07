package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/oauth2"
)

func TestMicrosoftUserInfo(t *testing.T) {
	const work = "72f988bf-86f1-41af-91ab-2d7cd011db47"
	cases := []struct {
		name, me, idToken, email string
	}{
		// The mail field is ignored: a tenant admin can set it to anyone's address.
		{"upn", `{"id":"abc","displayName":"Ada","userPrincipalName":"Ada@Contoso.com","mail":"victim@example.com"}`, `{"tid":"` + work + `"}`, "ada@contoso.com"},
		{"guest", `{"id":"abc","userPrincipalName":"ada_gmail.com#EXT#@contoso.onmicrosoft.com"}`, `{"tid":"` + work + `"}`, ""},
		{"no upn", `{"id":"abc","mail":"ada@contoso.com"}`, `{"tid":"` + work + `"}`, ""},
		{"no id", `{"userPrincipalName":"ada@contoso.com"}`, `{"tid":"` + work + `"}`, ""},
		{"no id_token", `{"id":"abc","userPrincipalName":"ada@contoso.com"}`, "", ""},
		// A personal account on someone else's domain needs xms_edov.
		{"personal unverified", `{"id":"abc","userPrincipalName":"victim@company.com"}`, `{"tid":"` + microsoftConsumersTenant + `"}`, ""},
		{"personal verified", `{"id":"abc","userPrincipalName":"ada@gmail.com"}`, `{"tid":"` + microsoftConsumersTenant + `","xms_edov":true}`, "ada@gmail.com"},
		{"personal verified string", `{"id":"abc","userPrincipalName":"ada@gmail.com"}`, `{"tid":"` + microsoftConsumersTenant + `","xms_edov":"1"}`, "ada@gmail.com"},
		{"personal outlook.com", `{"id":"abc","userPrincipalName":"ada@outlook.com"}`, `{"tid":"` + microsoftConsumersTenant + `"}`, "ada@outlook.com"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") != "Bearer tok" {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				_, _ = w.Write([]byte(tc.me))
			}))
			defer srv.Close()

			token := &oauth2.Token{AccessToken: "tok", TokenType: "Bearer"}
			if tc.idToken != "" {
				jwt := "e30." + base64.RawURLEncoding.EncodeToString([]byte(tc.idToken)) + ".sig"
				token = token.WithExtra(map[string]any{"id_token": jwt})
			}

			p := newMicrosoftProvider("id", "secret", "http://localhost/cb", nil)
			p.meURL = srv.URL
			info, err := p.GetUserInfo(context.Background(), token)
			if tc.email == "" {
				if err == nil {
					raw, _ := json.Marshal(info)
					t.Fatalf("want an error, got %s", raw)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if info.Email != tc.email || info.ProviderAccountID != "abc" {
				t.Fatalf("got email %q id %q", info.Email, info.ProviderAccountID)
			}
		})
	}
}
