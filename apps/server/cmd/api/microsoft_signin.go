package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/microsoft"

	authula "github.com/Authula/authula"
	"github.com/Authula/authula/middleware"
	authulamodels "github.com/Authula/authula/models"
	oauth2constants "github.com/Authula/authula/plugins/oauth2/constants"
	oauth2handlers "github.com/Authula/authula/plugins/oauth2/handlers"
	oauth2services "github.com/Authula/authula/plugins/oauth2/services"
	oauth2types "github.com/Authula/authula/plugins/oauth2/types"
	oauth2usecases "github.com/Authula/authula/plugins/oauth2/usecases"
)

// microsoftProviderID names the provider in its routes and in the accounts
// Authula links, the way "google" does for Google.
const microsoftProviderID = "microsoft"

// microsoftMeURL answers the signed-in user's Graph profile.
const microsoftMeURL = "https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName"

// microsoftConsumersTenant is the tenant id of personal Microsoft accounts.
const microsoftConsumersTenant = "9188040d-6c67-4c5b-b112-36a304b66dad"

// microsoftOwnedDomains are addresses only Microsoft hands out, so a personal
// account on one owns it without the xms_edov claim.
// ponytail: main domains only; a personal account on a country variant
// (hotmail.co.uk) or any other domain needs xms_edov in the ID token.
var microsoftOwnedDomains = map[string]bool{
	"outlook.com": true, "hotmail.com": true, "live.com": true, "msn.com": true,
}

// microsoftProvider is the Microsoft sign-in Authula's oauth2 plugin lacks
// (it ships Google, GitHub and Discord only, and its registry is closed).
// The common tenant takes personal (outlook.com) and work or school accounts.
type microsoftProvider struct {
	*oauth2services.BaseProvider
	meURL  string
	client *http.Client
	logger authulamodels.Logger
}

func newMicrosoftProvider(clientID, clientSecret, redirectURL string, logger authulamodels.Logger) *microsoftProvider {
	// The timeout matches the oauth2 plugin's own providers.
	client := &http.Client{Timeout: 10 * time.Second}
	return &microsoftProvider{
		BaseProvider: oauth2services.NewBaseProvider(microsoftProviderID, &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Endpoint:     microsoft.AzureADEndpoint("common"),
			Scopes:       []string{"openid", "email", "profile", "User.Read"},
		}, &oauth2services.ProviderOptions{HTTPClient: client, Logger: logger}, true),
		meURL:  microsoftMeURL,
		client: client,
		logger: logger,
	}
}

// GetUserInfo reads the address from userPrincipalName, never the email
// claim or Graph's mail: any tenant's admin can set those to someone else's
// address, and Authula signs into the user who has that address (nOAuth).
// A work or school UPN's domain must be verified by its tenant. A personal
// account can carry an address nobody verified, so it must be on a
// Microsoft-owned domain or come with xms_edov.
func (p *microsoftProvider) GetUserInfo(ctx context.Context, token *oauth2.Token) (*oauth2types.UserInfo, error) {
	info, err := oauth2services.FetchUserInfo(ctx, p.client, p.logger, token, p.meURL)
	if err != nil {
		return nil, err
	}
	id := oauth2services.GetStringField(info, "id")
	upn := strings.ToLower(oauth2services.GetStringField(info, "userPrincipalName"))
	// A guest's UPN (alice_example.com#EXT#@tenant) is not their address.
	at := strings.LastIndex(upn, "@")
	if id == "" || at < 1 || strings.Contains(upn, "#ext#") {
		return nil, errors.New("this Microsoft account has no usable email address")
	}
	claims, err := idTokenClaims(token)
	if err != nil {
		return nil, err
	}
	if claims.TID == microsoftConsumersTenant && !microsoftOwnedDomains[upn[at+1:]] && !claims.verified() {
		return nil, errors.New("this Microsoft account's email address is not verified")
	}
	return &oauth2types.UserInfo{
		ProviderAccountID: id,
		Email:             upn,
		// The checks above are the verification: Authula signs into an existing
		// user with this address only when the provider vouches for it.
		EmailVerified: true,
		Name:          oauth2services.GetStringField(info, "displayName"),
		Raw:           info,
	}, nil
}

// microsoftSignInRoutes serves GET /oauth2/authorize/microsoft and
// /oauth2/callback/microsoft with the oauth2 plugin's own handlers over a
// registry holding only Microsoft. The static paths win over the plugin's
// {provider} ones, and the "/oauth2/*" route mapping, the session, jwt and
// totp hooks and signInPaths all apply to them as they do to Google.
func microsoftSignInRoutes(auth *authula.Auth, cfg *authulamodels.Config, clientID, clientSecret string, logger authulamodels.Logger) []authulamodels.Route {
	registry := oauth2services.NewProviderRegistry()
	// Unreachable: the registry is new and empty.
	_ = registry.Register(microsoftProviderID, newMicrosoftProvider(clientID, clientSecret,
		cfg.BaseURL+cfg.BasePath+"/oauth2/callback/"+microsoftProviderID, logger))

	// The plugin's key, so the state cookies it signs read the same.
	hmacKey := oauth2services.DeriveOAuthHMACKey(cfg.Secret)
	core := auth.CoreServices()
	// The plugin's flow-cookie settings (see its routes.go).
	cookie := oauth2handlers.CookieOptions{
		Secure:   cfg.Session.Secure,
		Domain:   cfg.Session.Domain,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   oauth2constants.FlowCookieTTL,
	}
	authorize := &oauth2handlers.AuthorizeHandler{
		UseCase: oauth2usecases.NewAuthorizeUseCase(registry, logger, cfg.Security.TrustedOrigins, hmacKey),
		Cookie:  cookie,
		Logger:  logger,
	}
	callback := &oauth2handlers.CallbackHandler{
		UseCase: oauth2usecases.NewCallbackUseCase(cfg, registry, logger, hmacKey,
			core.UserService, core.AccountService, core.SessionService, core.TokenService),
		Cookie: cookie,
		Logger: logger,
	}

	// The handlers read the provider from the {provider} wildcard these
	// static paths don't have.
	withProvider := func(h http.HandlerFunc) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.SetPathValue("provider", microsoftProviderID)
			h(w, r)
		})
	}
	public := []func(http.Handler) http.Handler{middleware.RequirePublicOrUserActor()}
	return []authulamodels.Route{
		{Method: http.MethodGet, Path: "/oauth2/authorize/" + microsoftProviderID, Middleware: public, Handler: withProvider(authorize.Handle())},
		{Method: http.MethodGet, Path: "/oauth2/callback/" + microsoftProviderID, Middleware: public, Handler: withProvider(callback.Handle())},
	}
}

// microsoftClaims are the ID token claims the verification check reads.
type microsoftClaims struct {
	TID  string `json:"tid"`
	EDOV any    `json:"xms_edov"`
}

// verified reads xms_edov, which arrives as a boolean or a string.
func (c microsoftClaims) verified() bool {
	switch v := c.EDOV.(type) {
	case bool:
		return v
	case string:
		return v == "1" || strings.EqualFold(v, "true")
	case float64:
		return v == 1
	}
	return false
}

// idTokenClaims decodes the ID token of the token response. It comes straight
// from Microsoft's token endpoint over TLS, so its signature is not checked.
func idTokenClaims(token *oauth2.Token) (microsoftClaims, error) {
	var c microsoftClaims
	raw, _ := token.Extra("id_token").(string)
	parts := strings.Split(raw, ".")
	if len(parts) != 3 {
		return c, errors.New("microsoft sign-in returned no id_token")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return c, err
	}
	return c, json.Unmarshal(payload, &c)
}
