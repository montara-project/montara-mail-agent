package handlers

import (
	"slices"

	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/dtos"
)

// OAuthProviders lists the providers whose OAuth client is configured, so
// the web app shows only the buttons that work: sign_in for "Login with"
// (google, microsoft), mailbox for "Connect" (gmail, outlook, yahoo, zoho).
// Public: the sign-in page asks before anyone is signed in, and it names no
// client id or secret.
func (h *healthHandler) OAuthProviders(c fiber.Ctx) error {
	auth := h.app.Config.Auth
	signIn := []string{}
	if auth.GoogleClientID != "" && auth.GoogleClientSecret != "" {
		signIn = append(signIn, "google")
	}
	if auth.MicrosoftClientID != "" && auth.MicrosoftClientSecret != "" {
		signIn = append(signIn, "microsoft")
	}

	mailbox := []string{}
	for provider := range h.app.MailOAuth {
		if _, ok := h.app.MailOAuth.For(provider); ok {
			mailbox = append(mailbox, provider)
		}
	}
	slices.Sort(mailbox)

	return dtos.OK(c, fiber.Map{"sign_in": signIn, "mailbox": mailbox})
}
