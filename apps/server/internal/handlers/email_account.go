package handlers

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"html"
	"net/url"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"golang.org/x/oauth2"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/lib/mailoauth"
	"montara-mail-agent/server/internal/mailsync"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type emailAccountHandler struct {
	app  *app.Application
	sync *mailsync.Syncer
}

func (h *emailAccountHandler) repo() *repositories.EmailAccountRepository {
	return &h.app.Repositories.EmailAccount
}

// account loads the :id account, for members of its organization only.
func (h *emailAccountHandler) account(c fiber.Ctx) (models.EmailAccount, error) {
	id, err := pathID(c, "email account")
	if err != nil {
		return models.EmailAccount{}, err
	}
	account, err := h.repo().Get(c.Context(), id)
	if err != nil {
		return account, err
	}
	if _, err := member(c, h.app, account.OrganizationID); err != nil {
		if err == errOrganizationNotFound {
			// Same answer as a missing account.
			err = apperr.New(apperr.KindNotFound, "record not found in email_accounts")
		}
		return models.EmailAccount{}, err
	}
	return account, nil
}

// List returns the organization's accounts with their unread and spam counts.
func (h *emailAccountHandler) List(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, organizationID); err != nil {
		return err
	}

	accounts, err := h.repo().ListByOrganization(c.Context(), organizationID)
	if err != nil {
		return err
	}
	return dtos.List(c, accounts, dtos.ListMeta(len(accounts), 0, len(accounts)))
}

// Create connects a mailbox: it signs in first, so wrong credentials are
// refused, then saves the account and syncs it in the background.
func (h *emailAccountHandler) Create(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, organizationID); err != nil {
		return err
	}

	var body dtos.EmailAccountBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	account := models.EmailAccount{
		OrganizationID: organizationID,
		Provider:       body.Provider,
		Email:          strings.TrimSpace(body.Email),
		Label:          strings.TrimSpace(body.Label),
		Username:       strings.TrimSpace(body.Username),
	}
	if servers, ok := constant.ProviderServers[body.Provider]; ok {
		account.IMAPHost, account.IMAPPort = servers.IMAP.Host, servers.IMAP.Port
		account.SMTPHost, account.SMTPPort = servers.SMTP.Host, servers.SMTP.Port
	} else {
		if body.IMAPHost == "" {
			return apperr.New(apperr.KindBadRequest, "imap_host is required for a custom IMAP account")
		}
		account.IMAPHost, account.IMAPPort = body.IMAPHost, cmp.Or(body.IMAPPort, 993)
		account.SMTPHost = cmp.Or(body.SMTPHost, "smtp."+strings.TrimPrefix(body.IMAPHost, "imap."))
		account.SMTPPort = cmp.Or(body.SMTPPort, 465)
	}
	if account.Username == "" {
		account.Username = account.Email
	}
	if account.Label == "" {
		account.Label = account.Email
	}

	if err := h.sync.Verify(c.Context(), account.IMAPHost, account.IMAPPort, account.Username, body.Password); err != nil {
		return apperr.New(apperr.KindBadRequest, "couldn't connect to the mailbox: %v", err)
	}

	account.Password = h.app.Secrets.Seal(body.Password)
	if account.ID, err = uuid.NewV7(); err != nil {
		return err
	}
	if err := h.repo().Insert(c.Context(), account); err != nil {
		return err
	}

	account, err = h.repo().Get(c.Context(), account.ID)
	if err != nil {
		return err
	}
	// The first sync takes a while; the client polls the account list.
	go func() {
		if err := h.sync.Sync(context.Background(), account); err != nil {
			h.app.Logger.Warn("first mail sync failed", "account", account.ID, "error", err)
		}
	}()
	return dtos.Created(c, account, "email account connected")
}

// Delete disconnects an account and drops its synced mail.
func (h *emailAccountHandler) Delete(c fiber.Ctx) error {
	account, err := h.account(c)
	if err != nil {
		return err
	}
	if err := h.repo().Delete(c.Context(), account.ID); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "email account disconnected")
}

// OAuthStart answers with the provider's consent URL that connects a mailbox
// over OAuth. The browser goes there; the callback then creates the account.
func (h *emailAccountHandler) OAuthStart(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, organizationID); err != nil {
		return err
	}

	provider := c.Params("provider")
	p, ok := mailoauth.Get(provider)
	if !ok {
		return apperr.New(apperr.KindBadRequest, "%s has no OAuth sign-in; connect it with an app password", provider)
	}
	creds, ok := h.app.MailOAuth.For(provider)
	if !ok {
		return apperr.New(apperr.KindBadRequest, "OAuth for %s isn't configured on this server", provider)
	}

	// The state carries the flow between the two browser visits: which
	// organization it is for, which web app to return to, and the PKCE
	// verifier for the exchange.
	origin, err := requestOrigin(c, h.app.Config.App.CORSAllowedOrigins)
	if err != nil {
		return err
	}
	verifier := mailoauth.GenerateVerifier()
	state, err := mailoauth.SignState(h.app.Config.App.Secret, mailoauth.State{
		OrganizationID: organizationID.String(),
		Provider:       provider,
		Origin:         origin,
		Verifier:       verifier,
	})
	if err != nil {
		return err
	}

	authURL := p.ConsentURL(creds, mailoauth.RedirectURI(h.app.Config.Auth.BaseURL, provider), state, verifier)
	return dtos.OK(c, fiber.Map{"auth_url": authURL})
}

// OAuthCallback is where the provider sends the browser after consent: it
// trades the code for tokens, checks the mailbox accepts them, saves the
// account and returns the browser to the web app, whose account list shows
// it syncing. Every failure redirects with an error message instead of
// answering JSON — the browser is on the provider's way back, not in the SPA.
func (h *emailAccountHandler) OAuthCallback(c fiber.Ctx) error {
	provider := c.Params("provider")
	toAccount := func(origin, message string) error {
		target := origin + "/account"
		if message != "" {
			target += "?" + message
		}
		return c.Redirect().To(target)
	}
	fail := func(origin string, err error) error {
		h.app.Logger.Warn("oauth callback failed", "provider", provider, "error", err)
		return toAccount(origin, "error="+url.QueryEscape(err.Error()))
	}

	state, err := mailoauth.VerifyState(h.app.Config.App.Secret, c.Query("state"))
	if err != nil {
		return fail(fallbackOrigin(h.app), err)
	}
	if state.Provider != provider {
		return fail(state.Origin, errors.New("the provider in the state doesn't match the callback"))
	}
	if c.Query("error") != "" {
		return fail(state.Origin, errors.New(c.Query("error_description", c.Query("error"))))
	}

	p, ok := mailoauth.Get(provider)
	if !ok {
		return fail(state.Origin, errors.New(provider+" has no OAuth sign-in"))
	}
	creds, ok := h.app.MailOAuth.For(provider)
	if !ok {
		return fail(state.Origin, fmt.Errorf("OAuth for %s isn't configured on this server", provider))
	}

	exchangeCtx, cancel := context.WithTimeout(c.Context(), 30*time.Second)
	defer cancel()
	token, err := p.Exchange(exchangeCtx, creds, mailoauth.RedirectURI(h.app.Config.Auth.BaseURL, provider), c.Query("code"), state.Verifier)
	if err != nil {
		return fail(state.Origin, fmt.Errorf("the sign-in wasn't accepted: %w", err))
	}

	clientCtx, cancel := context.WithTimeout(c.Context(), 30*time.Second)
	defer cancel()
	email, err := p.MailboxEmail(clientCtx, oauth2.NewClient(clientCtx, oauth2.StaticTokenSource(token)), idToken(token))
	if err != nil {
		return fail(state.Origin, err)
	}

	organizationID, err := uuid.Parse(state.OrganizationID)
	if err != nil {
		return fail(state.Origin, errors.New("the organization in the state is malformed"))
	}
	account := models.EmailAccount{
		OrganizationID: organizationID,
		Provider:       provider,
		Email:          email,
		Label:          email,
		Username:       email,
	}
	if servers, ok := constant.ProviderServers[provider]; ok {
		account.IMAPHost, account.IMAPPort = servers.IMAP.Host, servers.IMAP.Port
		account.SMTPHost, account.SMTPPort = servers.SMTP.Host, servers.SMTP.Port
	}

	// The mailbox must accept the token before it is saved, like the
	// password flow refuses a wrong password.
	if err := h.sync.VerifyOAuth(clientCtx, account.IMAPHost, account.IMAPPort, account.Username, token.AccessToken); err != nil {
		return fail(state.Origin, fmt.Errorf("the mailbox refused the sign-in: %w", err))
	}

	if account.ID, err = uuid.NewV7(); err != nil {
		return fail(state.Origin, err)
	}
	account.OAuthAccessToken = h.app.Secrets.Seal(token.AccessToken)
	account.OAuthRefreshToken = h.app.Secrets.Seal(token.RefreshToken)
	if token.Expiry.IsZero() {
		token.Expiry = time.Now().Add(time.Hour)
	}
	account.OAuthTokenExpiry = &token.Expiry
	if err := h.repo().Insert(c.Context(), account); err != nil {
		return fail(state.Origin, err)
	}

	// The first sync takes a while; the account list polls until it lands.
	saved := account
	go func() {
		if err := h.sync.Sync(context.Background(), saved); err != nil {
			h.app.Logger.Warn("first mail sync failed", "account", saved.ID, "error", err)
		}
	}()
	h.app.Logger.Info("mailbox connected over OAuth", "account", account.ID, "provider", provider)
	return toAccount(state.Origin, "connected="+url.QueryEscape(provider))
}

// idToken returns the OIDC id token a token response carried, if any.
func idToken(token *oauth2.Token) string {
	id, _ := token.Extra("id_token").(string)
	return id
}

// requestOrigin is the web app's origin that started the flow — the Origin
// header, else the Referer's, else the first allowed CORS origin — which the
// callback redirects back to; the API can't know where the SPA lives on its
// own.
func requestOrigin(c fiber.Ctx, allowedOrigins string) (string, error) {
	origin := c.Get(fiber.HeaderOrigin)
	if origin == "" || origin == "null" {
		if ref := c.Get(fiber.HeaderReferer); ref != "" {
			if u, err := url.Parse(ref); err == nil {
				origin = u.Scheme + "://" + u.Host
			}
		}
	}
	if origin == "" || origin == "null" {
		if first, _, _ := strings.Cut(allowedOrigins, ","); strings.TrimSpace(first) != "" {
			origin = strings.TrimSpace(first)
		}
	}
	u, err := url.Parse(origin)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.Path != "" {
		return "", apperr.New(apperr.KindBadRequest, "the web app's origin can't be determined for the OAuth return")
	}
	return u.Scheme + "://" + u.Host, nil
}

// fallbackOrigin is where a callback whose state is missing or broken sends
// the browser: the first allowed CORS origin, else the API's own origin.
func fallbackOrigin(app *app.Application) string {
	if first, _, _ := strings.Cut(app.Config.App.CORSAllowedOrigins, ","); strings.TrimSpace(first) != "" {
		return strings.TrimSpace(first)
	}
	return app.Config.Auth.BaseURL
}

// Sync pulls the account's new mail now.
func (h *emailAccountHandler) Sync(c fiber.Ctx) error {
	account, err := h.account(c)
	if err != nil {
		return err
	}
	if err := h.sync.Sync(c.Context(), account); err != nil {
		return apperr.New(apperr.KindBadGateway, "sync failed: %v", err)
	}

	account, err = h.repo().Get(c.Context(), account.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, account)
}

// Mails lists one folder of the account, newest first, with the folder's
// unread count in the metadata.
func (h *emailAccountHandler) Mails(c fiber.Ctx) error {
	account, err := h.account(c)
	if err != nil {
		return err
	}

	var q dtos.MailListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()
	if q.Folder == "" {
		q.Folder = constant.FolderInbox
	}

	params := repositories.MailListParams{ListParams: listParams(q.ListQuery), Folder: q.Folder, Importance: q.Importance}
	repo := &h.app.Repositories.Mail

	mails, err := repo.List(c.Context(), account.ID, params)
	if err != nil {
		return err
	}
	total, err := repo.Count(c.Context(), account.ID, params)
	if err != nil {
		return err
	}
	unread, err := repo.Unread(c.Context(), account.ID, q.Folder)
	if err != nil {
		return err
	}

	meta := dtos.ListMeta(int(total), q.Offset, q.Limit)
	meta["unread"] = unread
	return dtos.List(c, mails, meta)
}

// Send sends a new mail from the account.
func (h *emailAccountHandler) Send(c fiber.Ctx) error {
	account, err := h.account(c)
	if err != nil {
		return err
	}
	var body dtos.MailSendBody
	attachments, err := mailBody(c, &body)
	if err != nil {
		return err
	}
	if len(body.To)+len(body.Cc) > dtos.MaxRecipients {
		return apperr.New(apperr.KindBadRequest, "a mail goes to at most %d addresses", dtos.MaxRecipients)
	}

	// Without HTML from the editor, the text stands in, escaped.
	htmlBody := body.HTML
	if htmlBody == "" {
		htmlBody = `<div style="white-space:pre-wrap">` + html.EscapeString(body.Text) + "</div>"
	}
	if err := h.sync.Compose(c.Context(), account, body.To, body.Cc, body.Subject, body.Text, htmlBody, attachments); err != nil {
		return serverError(err)
	}
	return dtos.Message(c, fiber.StatusOK, "mail sent")
}
