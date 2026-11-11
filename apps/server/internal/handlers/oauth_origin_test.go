package handlers

import (
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/config"
)

// The OAuth return goes to the web app that started the flow. The hosted
// SPA (served by the API under a no-referrer policy) arrives in Firefox
// with "Origin: null" and no Referer; it must not be sent to the first CORS
// origin, the marketing site.
func TestRequestOrigin(t *testing.T) {
	a := &app.Application{Config: config.Config{
		App:  config.ConfigApp{CORSAllowedOrigins: "https://site.test,http://localhost:3000"},
		Auth: config.ConfigAuth{BaseURL: "https://app.site.test"},
	}}
	r := fiber.New()
	r.Get("/", func(c fiber.Ctx) error {
		origin, err := requestOrigin(c, a)
		if err != nil {
			return c.SendString("error")
		}
		return c.SendString(origin)
	})

	for _, tc := range []struct {
		name, origin, site, want string
	}{
		{"same-origin SPA, no-referrer", "null", "same-origin", "https://app.site.test"},
		{"dev SPA on another port", "http://localhost:3000", "same-site", "http://localhost:3000"},
		{"no browser hints", "", "", "https://site.test"},
		{"unknown origin", "https://evil.test", "cross-site", "error"},
	} {
		req := httptest.NewRequest(fiber.MethodGet, "/", nil)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		if tc.site != "" {
			req.Header.Set("Sec-Fetch-Site", tc.site)
		}
		res, err := r.Test(req)
		if err != nil {
			t.Fatal(err)
		}
		body, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		if got := string(body); got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}
