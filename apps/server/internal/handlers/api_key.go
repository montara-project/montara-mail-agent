package handlers

import (
	"errors"
	"time"

	coreerrors "github.com/Authula/authula/core/errors"
	authulamodels "github.com/Authula/authula/models"
	apikeyplugin "github.com/Authula/authula/plugins/api-key"
	apikeyplugintypes "github.com/Authula/authula/plugins/api-key/types"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
)

// defaultAPIKeyDays is how long a key lives when the user does not say.
const defaultAPIKeyDays = 90

// apiKeyHandler manages the signed-in user's API keys, which sign MCP
// clients in to /mcp and nowhere else.
type apiKeyHandler struct {
	app *app.Application
}

// apiKeyView is a key as the API shows it: never its value or hash. Hint is
// its first and last characters, enough to tell keys apart. A key scoped to
// one organization names it; a global one has no organization.
type apiKeyView struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Hint             string     `json:"hint"`
	OrganizationID   *string    `json:"organization_id"`
	OrganizationName *string    `json:"organization_name"`
	CreatedAt        time.Time  `json:"created_at"`
	ExpiresAt        *time.Time `json:"expires_at"`
	LastUsedAt       *time.Time `json:"last_used_at"`
}

// newAPIKeyView shows k; orgName is the name of the organization it is scoped
// to, if any.
func newAPIKeyView(k *apikeyplugintypes.ApiKey, orgName string) apiKeyView {
	prefix := ""
	if k.Prefix != nil {
		prefix = *k.Prefix
	}
	v := apiKeyView{
		ID:         k.ID,
		Name:       k.Name,
		Hint:       prefix + k.Start + "…" + k.Last,
		CreatedAt:  k.CreatedAt,
		ExpiresAt:  k.ExpiresAt,
		LastUsedAt: k.LastRequestedAt,
	}
	if orgID := lib.APIKeyOrganization(k); orgID != uuid.Nil {
		id := orgID.String()
		v.OrganizationID, v.OrganizationName = &id, &orgName
	}
	return v
}

// orgName names the organization a key is scoped to: "" for a global key, or
// for an organization since deleted for good.
func (h *apiKeyHandler) orgName(c fiber.Ctx, k *apikeyplugintypes.ApiKey) string {
	orgID := lib.APIKeyOrganization(k)
	if orgID == uuid.Nil {
		return ""
	}
	org, err := h.app.Repositories.Organization.Get(c.Context(), orgID)
	if err != nil {
		return ""
	}
	return org.Name
}

func userActor(uid uuid.UUID) *authulamodels.Actor {
	return &authulamodels.Actor{ID: uid.String(), Type: authulamodels.ActorUser}
}

// keys returns the caller and the key service.
func (h *apiKeyHandler) keys(c fiber.Ctx) (uuid.UUID, *apikeyplugin.API, error) {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return uuid.Nil, nil, apperr.ErrUnauthorized
	}
	keys, ok := h.app.APIKeys()
	if !ok {
		return uuid.Nil, nil, apperr.New(apperr.KindUnavailable, "API keys are not available on this server")
	}
	return uid, keys, nil
}

// List returns the caller's keys, newest first.
func (h *apiKeyHandler) List(c fiber.Ctx) error {
	uid, keys, err := h.keys(c)
	if err != nil {
		return err
	}
	ownerType, ownerID := apikeyplugintypes.OwnerTypeUser, uid.String()
	page, err := keys.GetAll(c.Context(), userActor(uid), apikeyplugintypes.GetApiKeysRequest{
		OwnerType: &ownerType, OwnerID: &ownerID, Page: 1, Limit: 100,
	})
	if err != nil {
		return err
	}
	views := make([]apiKeyView, 0, len(page.Items))
	for _, k := range page.Items {
		views = append(views, newAPIKeyView(k, h.orgName(c, k)))
	}
	return dtos.List(c, views, dtos.ListMeta(len(views), 0, len(views)))
}

// Create makes a key for the caller. Its value is in this answer only: the
// server keeps a hash.
func (h *apiKeyHandler) Create(c fiber.Ctx) error {
	uid, keys, err := h.keys(c)
	if err != nil {
		return err
	}
	var body dtos.APIKeyBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	days := body.ExpiresInDays
	if days == 0 {
		days = defaultAPIKeyDays
	}
	expires := time.Now().UTC().AddDate(0, 0, days)

	// A scoped key names an organization its owner reaches today: a member's,
	// or any live one for a super user. /mcp checks the owner's reach again on
	// every call, so leaving the organization ends the key's access too.
	orgID, orgName, metadata := uuid.Nil, "", map[string]any(nil)
	if body.OrganizationID != "" {
		orgID = uuid.MustParse(body.OrganizationID)
		if _, err := member(c, h.app, orgID); err != nil {
			return err
		}
		org, err := h.app.Repositories.Organization.Get(c.Context(), orgID)
		if err != nil {
			return err
		}
		orgName, metadata = org.Name, map[string]any{lib.APIKeyOrganizationField: orgID.String()}
	}

	created, err := keys.Create(c.Context(), userActor(uid), apikeyplugintypes.CreateApiKeyRequest{
		Name:      body.Name,
		OwnerType: apikeyplugintypes.OwnerTypeUser,
		OwnerID:   uid.String(),
		ExpiresAt: &expires,
		Metadata:  metadata,
	})
	if err != nil {
		return err
	}
	scope := "for every organization"
	if orgName != "" {
		scope = "for " + orgName
	}
	recordActivity(c, h.app, orgID, constant.ActivityAPIKeyCreated, "Created the API key "+body.Name+" "+scope, map[string]any{"api_key_id": created.ApiKey.ID})
	return dtos.Created(c, fiber.Map{"api_key": newAPIKeyView(created.ApiKey, orgName), "key": created.RawApiKey}, "API key created")
}

// Delete revokes one of the caller's keys. Someone else's key reads as
// missing, not forbidden.
func (h *apiKeyHandler) Delete(c fiber.Ctx) error {
	uid, keys, err := h.keys(c)
	if err != nil {
		return err
	}
	id, err := pathID(c, "API key")
	if err != nil {
		return err
	}
	key, err := keys.GetByID(c.Context(), userActor(uid), id.String())
	if err == nil {
		err = keys.Delete(c.Context(), userActor(uid), id.String())
	}
	if errors.Is(err, coreerrors.ErrNotFound) || errors.Is(err, coreerrors.ErrForbidden) {
		return apperr.New(apperr.KindNotFound, "API key not found")
	}
	if err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivityAPIKeyRevoked, "Revoked the API key "+key.Name, map[string]any{"api_key_id": key.ID})
	return dtos.Message(c, fiber.StatusOK, "API key revoked")
}
