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
)

type llmProviderHandler struct {
	app *app.Application
}

// llmProviderView is a provider as the API shows it: never the key itself.
type llmProviderView struct {
	models.LLMProvider
	HasAPIKey bool `json:"has_api_key"`
}

// Get returns the organization's provider, or null when it has none. The
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
	meta := dtos.Metadata{"fallback": h.app.AI != nil, "private_hosts": h.app.Config.App.AllowPrivateHosts}
	p, err := h.app.Repositories.LLMProvider.Get(c.Context(), organizationID)
	if apperr.IsNotFound(err) {
		return dtos.Response(c, fiber.StatusOK, nil, meta, "")
	}
	if err != nil {
		return err
	}
	return dtos.Response(c, fiber.StatusOK, llmProviderView{p, len(p.APIKey) > 0}, meta, "")
}

// Put creates or replaces the organization's provider; owner only, since it
// holds a paid API key.
func (h *llmProviderHandler) Put(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if err := owner(c, h.app, organizationID); err != nil {
		return err
	}

	var body dtos.LLMProviderBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	key, err := h.apiKey(c, organizationID, body.Kind, body.BaseURL, body.APIKey)
	if err != nil {
		return err
	}

	repo := &h.app.Repositories.LLMProvider
	p := models.LLMProvider{OrganizationID: organizationID, Kind: body.Kind, BaseURL: body.BaseURL, Model: body.Model, APIKey: []byte{}}
	if key != "" {
		p.APIKey = h.app.Secrets.Seal(key)
	}
	if err := repo.Upsert(c.Context(), p); err != nil {
		return err
	}
	if p, err = repo.Get(c.Context(), organizationID); err != nil {
		return err
	}
	return dtos.OK(c, llmProviderView{p, key != ""})
}

// Models lists the models a provider offers, so the settings form can offer
// them instead of a free-text id. It takes the form's unsaved values; owner
// only, since it may use the saved key.
func (h *llmProviderHandler) Models(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if err := owner(c, h.app, organizationID); err != nil {
		return err
	}

	var body dtos.LLMModelsBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	key, err := h.apiKey(c, organizationID, body.Kind, body.BaseURL, body.APIKey)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
	defer cancel()
	ids, err := llm.ListModels(ctx, llm.Config{Kind: body.Kind, BaseURL: body.BaseURL, APIKey: key, HTTPClient: h.app.HTTPClient})
	if err != nil {
		h.app.Logger.Warn("list LLM models", "organization", organizationID, "error", err)
		return apperr.New(apperr.KindBadGateway, "couldn't list the provider's models: check the base URL and the API key")
	}
	return dtos.OK(c, ids)
}

// apiKey returns the key to call a provider with: the given one, else the
// saved one when the provider is the same (kind and base URL), else none,
// which only a self-hosted server may go without. A saved key never goes to
// another URL than the one it was saved for.
func (h *llmProviderHandler) apiKey(c fiber.Ctx, organizationID uuid.UUID, kind, baseURL, given string) (string, error) {
	if kind == llm.KindSelfHosted && baseURL == "" {
		return "", apperr.New(apperr.KindBadRequest, "base_url is required for a self-hosted model")
	}

	key := given
	if key == "" {
		saved, err := h.app.Repositories.LLMProvider.Get(c.Context(), organizationID)
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

// Delete removes the organization's provider, falling back to the server's model.
func (h *llmProviderHandler) Delete(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if err := owner(c, h.app, organizationID); err != nil {
		return err
	}
	if err := h.app.Repositories.LLMProvider.Delete(c.Context(), organizationID); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "LLM provider removed")
}
