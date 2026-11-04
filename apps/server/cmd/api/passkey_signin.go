package main

import (
	"errors"
	"io"
	"net/http"
	"net/url"

	authula "github.com/Authula/authula"
	"github.com/Authula/authula/middleware"
	authulamodels "github.com/Authula/authula/models"

	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/passkey"
	"montara-mail-agent/server/internal/repositories"
)

// maxPasskeyBody bounds a sign-in answer; a real one is a few kilobytes.
const maxPasskeyBody = 64 << 10

// passkeySignInRoutes serve POST /passkey/options, the challenge, and POST
// /passkey/sign-in, which verifies the browser's answer and opens a session
// the way the email-password sign-in does: the session cookie, jwt and
// activity hooks then run as they do for it. No route mapping puts
// totp.intercept here: a passkey with user verification is two factors
// already. Every failure answers 401 alike, which ipblock counts (signInPaths).
func passkeySignInRoutes(auth *authula.Auth, cfg *authulamodels.Config, passkeys *passkey.Service, logger authulamodels.Logger) []authulamodels.Route {
	public := []func(http.Handler) http.Handler{middleware.RequirePublicOrUserActor()}

	options := http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		reqCtx, _ := authulamodels.GetRequestContext(r.Context())
		assertion, err := passkeys.BeginLogin()
		if err != nil {
			logger.Error("passkey options", "error", err)
			reqCtx.SetJSONResponse(http.StatusServiceUnavailable, map[string]any{"message": "passkey sign-in is unavailable, try again shortly"})
			reqCtx.Handled = true
			return
		}
		reqCtx.SetJSONResponse(http.StatusOK, assertion)
	})

	signIn := http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		reqCtx, _ := authulamodels.GetRequestContext(r.Context())
		fail := func(status int, message string) {
			reqCtx.SetJSONResponse(status, map[string]any{"message": message})
			reqCtx.Handled = true
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxPasskeyBody))
		if err != nil {
			fail(http.StatusBadRequest, "the passkey answer can't be read")
			return
		}
		ctx := r.Context()
		uid, err := passkeys.FinishLogin(ctx, body)
		if errors.Is(err, passkey.ErrNotRecognized) {
			fail(http.StatusUnauthorized, err.Error())
			return
		}
		if err != nil {
			logger.Error("passkey sign-in", "error", err)
			fail(http.StatusInternalServerError, "failed to sign in")
			return
		}

		services := auth.CoreServices()
		user, err := services.UserService.GetByID(ctx, uid.String())
		if err != nil || user == nil {
			fail(http.StatusUnauthorized, passkey.ErrNotRecognized.Error())
			return
		}
		token, err := services.TokenService.Generate()
		if err != nil {
			fail(http.StatusInternalServerError, "failed to sign in")
			return
		}
		userAgent := r.UserAgent()
		session, err := services.SessionService.Create(ctx, user.ID, services.TokenService.Hash(token), &reqCtx.ClientIP, &userAgent, cfg.Session.ExpiresIn)
		if err != nil {
			logger.Error("passkey sign-in session", "error", err)
			fail(http.StatusInternalServerError, "failed to sign in")
			return
		}

		reqCtx.SetActorInContext(&authulamodels.Actor{ID: user.ID, Type: authulamodels.ActorUser})
		reqCtx.Values[authulamodels.ContextSessionID.String()] = session.ID
		reqCtx.Values[authulamodels.ContextSessionToken.String()] = token
		reqCtx.Values[authulamodels.ContextAuthSuccess.String()] = true
		reqCtx.SetJSONResponse(http.StatusOK, map[string]any{"user": user, "session": session})
	})

	return []authulamodels.Route{
		{Method: http.MethodPost, Path: "/passkey/options", Middleware: public, Handler: options},
		{Method: http.MethodPost, Path: "/passkey/sign-in", Middleware: public, Handler: signIn},
	}
}

// newPasskeys builds the relying party for the web app: the CORS origins, where
// a web app on another site runs, then the API's own, where the bundled SPA
// does. The first one names the relying party, so a passkey is bound to it.
// ponytail: origins on more than one domain need a relying party each; add an
// explicit RP ID setting if a deployment ever splits them.
func newPasskeys(cfg config.Config, repo *repositories.PasskeyRepository) (*passkey.Service, error) {
	origins := splitCSV(cfg.App.CORSAllowedOrigins)
	if base, err := url.Parse(cfg.Auth.BaseURL); err == nil && base.Host != "" {
		origins = append(origins, base.Scheme+"://"+base.Host)
	}
	return passkey.New(cfg.App.Name, origins, repo)
}
