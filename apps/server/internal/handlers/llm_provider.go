package handlers

import (
	"net/url"

	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
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

	meta := dtos.Metadata{"fallback": h.app.AI != nil}
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

	// The key would cross the network in clear text over http; that is only
	// acceptable for a model on the server's own network.
	if body.BaseURL != "" {
		if u, err := url.Parse(body.BaseURL); err != nil || u.Host == "" || (u.Scheme != "https" && !h.app.Config.App.AllowPrivateHosts) {
			return apperr.New(apperr.KindBadRequest, "base_url must be an https URL")
		}
	}

	repo := &h.app.Repositories.LLMProvider
	p := models.LLMProvider{OrganizationID: organizationID, Kind: body.Kind, BaseURL: body.BaseURL, Model: body.Model}
	if body.APIKey != "" {
		p.APIKey = h.app.Secrets.Seal(body.APIKey)
	} else {
		saved, err := repo.Get(c.Context(), organizationID)
		if apperr.IsNotFound(err) {
			return apperr.New(apperr.KindBadRequest, "api_key is required")
		}
		if err != nil {
			return err
		}
		p.APIKey = saved.APIKey
	}

	if err := repo.Upsert(c.Context(), p); err != nil {
		return err
	}
	if p, err = repo.Get(c.Context(), organizationID); err != nil {
		return err
	}
	return dtos.OK(c, llmProviderView{p, true})
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
