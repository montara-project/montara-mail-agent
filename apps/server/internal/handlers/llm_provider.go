package handlers

import (
	"context"
	"net/url"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type llmProviderHandler struct {
	app *app.Application
}

// llmProviderView is a provider as the API shows it: never the key itself.
type llmProviderView struct {
	models.LLMProvider
	HasAPIKey bool `json:"has_api_key"`
}

// scope is the provider a route works on: the organization in the path, or
// nil, the global one, on the /llm-providers/global routes.
func scope(c fiber.Ctx) (*uuid.UUID, error) {
	if c.Params("id") == "" {
		return nil, nil
	}
	id, err := pathID(c, "organization")
	return &id, err
}

// manage checks that the signed-in user may change the provider of a scope:
// the organization's owner, or a super user for the global one.
func (h *llmProviderHandler) manage(c fiber.Ctx, scope *uuid.UUID) error {
	if scope != nil {
		return owner(c, h.app, *scope)
	}
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	super, err := isSuperUser(c.Context(), h.app, uid)
	if err != nil {
		return err
	}
	if !super {
		return apperr.New(apperr.KindForbidden, "only a super user can change the global provider")
	}
	return nil
}

// List returns the providers the user can see: the global one and those of
// their organizations, or all of them for a super user. The metadata says
// whether the user may manage the global one and whether the server's
// fallback model covers an organization with neither.
func (h *llmProviderHandler) List(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	super, err := isSuperUser(c.Context(), h.app, uid)
	if err != nil {
		return err
	}
	rows, err := h.app.Repositories.LLMProvider.List(c.Context(), uid, super)
	if err != nil {
		return err
	}
	views := make([]llmProviderListView, len(rows))
	for i, row := range rows {
		views[i] = llmProviderListView{row, len(row.APIKey) > 0}
	}
	meta := dtos.Metadata{"super_user": super, "fallback": h.app.AIConfig != nil || h.app.AI != nil, "private_hosts": h.app.Config.App.AllowPrivateHosts}
	return dtos.Response(c, fiber.StatusOK, views, meta, "")
}

// llmProviderListView is a listed provider as the API shows it.
type llmProviderListView struct {
	repositories.LLMProviderListed
	HasAPIKey bool `json:"has_api_key"`
}

// SetScope moves a provider to an organization, or to global with an empty
// organization_id. The user must be able to manage both scopes.
func (h *llmProviderHandler) SetScope(c fiber.Ctx) error {
	id, err := pathID(c, "LLM provider")
	if err != nil {
		return err
	}
	var body dtos.LLMProviderScopeBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	var target *uuid.UUID
	if body.OrganizationID != "" {
		orgID := uuid.MustParse(body.OrganizationID)
		target = &orgID
	}

	repo := &h.app.Repositories.LLMProvider
	p, err := repo.GetByID(c.Context(), id)
	if err != nil {
		return err
	}
	if err := h.manage(c, p.OrganizationID); err != nil {
		return err
	}
	if body.PlatformUser {
		uid, err := lib.ContextGetUID(c)
		if err != nil {
			return apperr.ErrUnauthorized
		}
		if super, err := isSuperUser(c.Context(), h.app, uid); err != nil {
			return err
		} else if !super {
			return apperr.New(apperr.KindForbidden, "only a super user can change the platform-user provider")
		}
	} else if err := h.manage(c, target); err != nil {
		return err
	}
	if err := repo.SetScope(c.Context(), id, target, body.PlatformUser); err != nil {
		return err
	}
	if p, err = repo.GetByID(c.Context(), id); err != nil {
		return err
	}
	return dtos.OK(c, llmProviderView{p, len(p.APIKey) > 0})
}

// Get returns the organization's own provider, or null when it has none. The
// metadata says whether the server's fallback model covers that case.
func (h *llmProviderHandler) Get(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, organizationID); err != nil {
		return err
	}

	// private_hosts tells the self-hosted form whether a model on localhost
	// or the LAN is reachable at all (see lib.GuardedDialer).
	meta := dtos.Metadata{"fallback": h.app.AIConfig != nil || h.app.AI != nil, "private_hosts": h.app.Config.App.AllowPrivateHosts}
	p, err := h.app.Repositories.LLMProvider.Get(c.Context(), &organizationID)
	if apperr.IsNotFound(err) {
		return dtos.Response(c, fiber.StatusOK, nil, meta, "")
	}
	if err != nil {
		return err
	}
	return dtos.Response(c, fiber.StatusOK, llmProviderView{p, len(p.APIKey) > 0}, meta, "")
}

// Put creates or replaces the provider of the route's scope; owner (or super
// user for the global one) only, since it holds a paid API key.
func (h *llmProviderHandler) Put(c fiber.Ctx) error {
	scope, err := scope(c)
	if err != nil {
		return err
	}
	if err := h.manage(c, scope); err != nil {
		return err
	}

	var body dtos.LLMProviderBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	key, err := h.apiKey(c, scope, body.Kind, body.BaseURL, body.APIKey)
	if err != nil {
		return err
	}

	repo := &h.app.Repositories.LLMProvider
	p := models.LLMProvider{OrganizationID: scope, Name: body.Name, Kind: body.Kind, BaseURL: body.BaseURL, Model: body.Model, APIKey: []byte{}}
	if key != "" {
		p.APIKey = h.app.Secrets.Seal(key)
	}
	if err := repo.Upsert(c.Context(), p); err != nil {
		return err
	}
	if p, err = repo.Get(c.Context(), scope); err != nil {
		return err
	}
	return dtos.OK(c, llmProviderView{p, key != ""})
}

// Models lists the models a provider offers, so the settings form can offer
// them instead of a free-text id. It takes the form's unsaved values; owner
// only, since it may use the saved key.
func (h *llmProviderHandler) Models(c fiber.Ctx) error {
	scope, err := scope(c)
	if err != nil {
		return err
	}
	if err := h.manage(c, scope); err != nil {
		return err
	}

	var body dtos.LLMModelsBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	key, err := h.apiKey(c, scope, body.Kind, body.BaseURL, body.APIKey)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()
	ids, err := llm.ListModels(ctx, llm.Config{Kind: body.Kind, BaseURL: body.BaseURL, APIKey: key, HTTPClient: h.app.HTTPClient})
	if err != nil {
		h.app.Logger.Warn("list LLM models", "organization", scope, "error", err)
		return apperr.New(apperr.KindBadGateway, "couldn't list the provider's models: check the base URL and the API key")
	}
	return dtos.OK(c, ids)
}

// apiKey returns the key to call a provider with: the given one, else the
// saved one when the provider is the same (kind and base URL), else none,
// which only a self-hosted server may go without. A saved key never goes to
// another URL than the one it was saved for.
func (h *llmProviderHandler) apiKey(c fiber.Ctx, scope *uuid.UUID, kind, baseURL, given string) (string, error) {
	if kind == llm.KindSelfHosted && baseURL == "" {
		return "", apperr.New(apperr.KindBadRequest, "base_url is required for a self-hosted model")
	}

	key := given
	if key == "" {
		saved, err := h.app.Repositories.LLMProvider.Get(c.Context(), scope)
		if err != nil && !apperr.IsNotFound(err) {
			return "", err
		}
		if err == nil && saved.Kind == kind && saved.BaseURL == baseURL && len(saved.APIKey) > 0 {
			if key, err = h.app.Secrets.Open(saved.APIKey); err != nil {
				return "", apperr.New(apperr.KindBadRequest, "the saved API key can't be read, enter it again")
			}
		}
	}
	if key == "" && kind != llm.KindSelfHosted {
		return "", apperr.New(apperr.KindBadRequest, "api_key is required")
	}

	// A key would cross the network in clear text over http; that is only
	// acceptable for a model on the server's own network.
	if baseURL != "" {
		u, err := url.Parse(baseURL)
		if err != nil || u.Host == "" {
			return "", apperr.New(apperr.KindBadRequest, "base_url is not a valid URL")
		}
		if u.Scheme != "https" && key != "" && !h.app.Config.App.AllowPrivateHosts {
			return "", apperr.New(apperr.KindBadRequest, "base_url must be an https URL when an API key is set")
		}
	}
	return key, nil
}

// Delete removes the provider of the route's scope: an organization then
// falls back to the global provider, and that to the server's model.
func (h *llmProviderHandler) Delete(c fiber.Ctx) error {
	scope, err := scope(c)
	if err != nil {
		return err
	}
	if err := h.manage(c, scope); err != nil {
		return err
	}
	if err := h.app.Repositories.LLMProvider.Delete(c.Context(), scope); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "LLM provider removed")
}

// managePlatform guards the platform-user scope: a super user only.
func (h *llmProviderHandler) managePlatform(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	super, err := isSuperUser(c.Context(), h.app, uid)
	if err != nil {
		return err
	}
	if !super {
		return apperr.New(apperr.KindForbidden, "only a super user can manage the platform-user provider")
	}
	return nil
}

// GetPlatform returns the platform-user provider, or null when there is none.
func (h *llmProviderHandler) GetPlatform(c fiber.Ctx) error {
	if err := h.managePlatform(c); err != nil {
		return err
	}
	meta := dtos.Metadata{"fallback": h.app.AIConfig != nil || h.app.AI != nil, "private_hosts": h.app.Config.App.AllowPrivateHosts}
	p, err := h.app.Repositories.LLMProvider.GetPlatform(c.Context())
	if apperr.IsNotFound(err) {
		return dtos.Response(c, fiber.StatusOK, nil, meta, "")
	}
	if err != nil {
		return err
	}
	return dtos.Response(c, fiber.StatusOK, llmProviderView{p, len(p.APIKey) > 0}, meta, "")
}

// PutPlatform creates or replaces the platform-user provider.
func (h *llmProviderHandler) PutPlatform(c fiber.Ctx) error {
	if err := h.managePlatform(c); err != nil {
		return err
	}
	var body dtos.LLMProviderBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	key, err := h.apiKey(c, nil, body.Kind, body.BaseURL, body.APIKey)
	if err != nil {
		return err
	}

	repo := &h.app.Repositories.LLMProvider
	p := models.LLMProvider{OrganizationID: nil, PlatformUser: true, Name: body.Name, Kind: body.Kind, BaseURL: body.BaseURL, Model: body.Model, APIKey: []byte{}}
	if key != "" {
		p.APIKey = h.app.Secrets.Seal(key)
	}
	if err := repo.Upsert(c.Context(), p); err != nil {
		return err
	}
	if p, err = repo.GetPlatform(c.Context()); err != nil {
		return err
	}
	return dtos.OK(c, llmProviderView{p, key != ""})
}

// ModelsPlatform lists the models the platform-user provider offers.
func (h *llmProviderHandler) ModelsPlatform(c fiber.Ctx) error {
	if err := h.managePlatform(c); err != nil {
		return err
	}
	var body dtos.LLMModelsBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	key, err := h.apiKey(c, nil, body.Kind, body.BaseURL, body.APIKey)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()
	ids, err := llm.ListModels(ctx, llm.Config{Kind: body.Kind, BaseURL: body.BaseURL, APIKey: key, HTTPClient: h.app.HTTPClient})
	if err != nil {
		return apperr.New(apperr.KindBadGateway, "couldn't list the provider's models: check the base URL and the API key")
	}
	return dtos.OK(c, ids)
}

// DeletePlatform removes the platform-user provider.
func (h *llmProviderHandler) DeletePlatform(c fiber.Ctx) error {
	if err := h.managePlatform(c); err != nil {
		return err
	}
	if err := h.app.Repositories.LLMProvider.DeletePlatform(c.Context()); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "LLM provider removed")
}
