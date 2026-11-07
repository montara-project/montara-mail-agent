package handlers

import (
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
)

// maxPasskeyName bounds the label the user gives a passkey.
const maxPasskeyName = 64

// passkeyHandler manages the signed-in user's passkeys. Signing in with one
// is an Authula route (cmd/api/passkey_signin.go).
type passkeyHandler struct {
	app *app.Application
}

// List returns the user's passkeys, oldest first; never their key material.
func (h *passkeyHandler) List(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	keys, err := h.app.Repositories.Passkey.ListByUser(c.Context(), uid)
	if err != nil {
		return err
	}
	return dtos.List(c, keys, dtos.ListMeta(len(keys), 0, len(keys)))
}

// passkeyOptionsBody confirms the caller before a passkey is registered (see
// ConfirmIdentity); empty for a user without a password.
type passkeyOptionsBody struct {
	Password string `json:"password"`
}

// Options starts registering a passkey once the caller confirms who they are:
// the options for navigator.credentials.create, valid for a few minutes.
// Create needs the challenge handed out here, so it is the one check.
func (h *passkeyHandler) Options(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	var body passkeyOptionsBody
	// An empty body leaves the password empty, which ConfirmIdentity refuses
	// for a user who has one.
	_ = json.Unmarshal(c.Body(), &body)
	core := h.app.Auth.CoreServices()
	if err := ConfirmIdentity(c.Context(), core, uid.String(), lib.ContextGetSessionID(c), body.Password); err != nil {
		return err
	}
	user, err := core.UserService.GetByID(c.Context(), uid.String())
	if err != nil {
		return err
	}
	if user == nil {
		return apperr.ErrUnauthorized
	}
	creation, err := h.app.Passkeys.BeginRegistration(c.Context(), uid, user.Email, user.Name)
	if err != nil {
		return err
	}
	return dtos.OK(c, creation)
}

// passkeyBody is the browser's answer to Options and the passkey's label.
type passkeyBody struct {
	Name       string          `json:"name"`
	Credential json.RawMessage `json:"credential"`
}

// Create finishes registering a passkey.
func (h *passkeyHandler) Create(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	var body passkeyBody
	if err := json.Unmarshal(c.Body(), &body); err != nil || len(body.Credential) == 0 {
		return apperr.New(apperr.KindBadRequest, "send the passkey as credential")
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		name = "Passkey"
	}
	if len([]rune(name)) > maxPasskeyName {
		return apperr.New(apperr.KindBadRequest, "the name must be at most %d characters", maxPasskeyName)
	}
	key, err := h.app.Passkeys.FinishRegistration(c.Context(), uid, name, body.Credential)
	if err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivityPasskeyAdded, "Added the passkey "+name, map[string]any{"passkey_id": key.ID})
	return dtos.Created(c, key, "passkey added")
}

// Delete removes one of the user's passkeys. Someone else's reads as missing.
func (h *passkeyHandler) Delete(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	id, err := pathID(c, "passkey")
	if err != nil {
		return err
	}
	if err := h.app.Repositories.Passkey.Delete(c.Context(), uid, id); err != nil {
		if apperr.IsNotFound(err) {
			return apperr.New(apperr.KindNotFound, "passkey not found")
		}
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivityPasskeyRemoved, "Removed a passkey", map[string]any{"passkey_id": id})
	return dtos.Message(c, fiber.StatusOK, "passkey removed")
}
