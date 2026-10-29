package middlewares

import (
	"strings"
	"time"

	authulamodels "github.com/Authula/authula/models"
	apikeyplugintypes "github.com/Authula/authula/plugins/api-key/types"
	authulaservices "github.com/Authula/authula/services"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
)

// bearerToken returns the token of an "Authorization: Bearer <token>" header,
// or "" when the header is absent or uses another scheme.
func bearerToken(header string) string {
	scheme, token, _ := strings.Cut(header, " ")
	if !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

// Authorization requires a valid JWT access token or a live Authula session
// cookie and stores the signed-in user's id for handlers (see
// lib.ContextGetUID). It mirrors the "bearer.auth.optional" + "session.auth"
// checks for routes outside the Authula handler; sliding session renewal
// still happens on Authula's own routes (e.g. /me).
func (m *Middlewares) Authorization(c fiber.Ctx) error {
	userID := m.bearerUserID(c)
	if userID == "" {
		userID = m.sessionUserID(c)
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	lib.ContextSetUID(c, uid)

	return c.Next()
}

// APIKey requires one of the user's API keys as "Authorization: Bearer
// <key>" and stores its owner's id like Authorization does. Only /mcp takes
// it: a key leaked from an MCP client reaches the mailbox tools, not the
// account. Access tokens and session cookies are not accepted here.
func (m *Middlewares) APIKey(c fiber.Ctx) error {
	token := bearerToken(c.Get(fiber.HeaderAuthorization))
	keys, ok := m.app.APIKeys()
	if token == "" || !ok {
		return apperr.ErrUnauthorized
	}

	result, err := keys.Verify(c.Context(), apikeyplugintypes.VerifyApiKeyRequest{Key: token})
	if err != nil {
		return err
	}
	if !result.Valid || result.ApiKey.OwnerType != apikeyplugintypes.OwnerTypeUser {
		return apperr.ErrUnauthorized
	}
	uid, err := uuid.Parse(result.ApiKey.OwnerID)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	// The settings page shows when a key was last used; a failed stamp only
	// costs that.
	if _, err := keys.RecordLastRequest(c.Context(), result.ApiKey.ID, time.Now().UTC()); err != nil {
		m.app.Logger.Warn("api key last use not recorded", "api_key", result.ApiKey.ID, "error", err)
	}
	lib.ContextSetUID(c, uid)
	return c.Next()
}

// bearerUserID returns the user a valid access token belongs to, or "". The
// jwt plugin verifies the signature and expiry and that the token's session
// still exists, so signing out revokes it. It does not check that the session
// is still live, so that is checked here.
func (m *Middlewares) bearerUserID(c fiber.Ctx) string {
	token := bearerToken(c.Get(fiber.HeaderAuthorization))
	if token == "" {
		return ""
	}

	jwt, ok := m.app.Auth.ServiceRegistry.Get(authulamodels.ServiceJWT.String()).(authulaservices.JWTService)
	if !ok {
		return ""
	}
	actor, err := jwt.ValidateToken(c.Context(), token)
	if err != nil || actor.Type != authulamodels.ActorUser {
		return ""
	}

	sessionID, _ := actor.Claims["session_id"].(string)
	session, err := m.app.Auth.CoreServices().SessionService.GetByID(c.Context(), sessionID)
	if err != nil || session == nil || session.ExpiresAt.Before(time.Now().UTC()) {
		return ""
	}
	return actor.ID
}

// sessionUserID returns the user of a live session cookie, or "".
func (m *Middlewares) sessionUserID(c fiber.Ctx) string {
	token := c.Cookies(config.SessionCookieName)
	if token == "" {
		return ""
	}

	services := m.app.Auth.CoreServices()
	session, err := services.SessionService.GetByToken(c.Context(), services.TokenService.Hash(token))
	if err != nil || session == nil || session.ExpiresAt.Before(time.Now().UTC()) {
		return ""
	}
	return session.UserID
}
