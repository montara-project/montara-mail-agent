package handlers

import (
	"time"

	authulamodels "github.com/Authula/authula/models"
	apikeyplugintypes "github.com/Authula/authula/plugins/api-key/types"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
)

// profileHandler serves the signed-in user's own account. Authula owns the
// user and its password; these go through its core services, so the user
// hooks (the public mirror) still run.
type profileHandler struct {
	app *app.Application
}

// security is what the settings pages need to know about the user's sign-in.
type security struct {
	// HasPassword is false for a user who only signs in with Google or a magic link.
	HasPassword bool `json:"has_password"`
	TOTPEnabled bool `json:"totp_enabled"`
	// SuperUser shows the platform pages (IP blocks) in the web app.
	SuperUser bool `json:"super_user"`
}

// Security returns whether the user has a password and two-factor sign-in.
func (h *profileHandler) Security(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	account, err := h.app.Auth.CoreServices().AccountService.GetByUserIDAndProvider(c.Context(), uid.String(), authulamodels.AuthProviderEmail.String())
	if err != nil {
		return err
	}
	totp, err := h.app.Repositories.User.TOTPEnabled(c.Context(), uid)
	if err != nil {
		return err
	}
	super, err := isSuperUser(c.Context(), h.app, uid)
	if err != nil {
		return err
	}
	return dtos.OK(c, security{HasPassword: account != nil && account.Password != nil, TOTPEnabled: totp, SuperUser: super})
}

// Update changes the user's name and avatar.
func (h *profileHandler) Update(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	var body dtos.ProfileBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	users := h.app.Auth.CoreServices().UserService
	user, err := users.GetByID(c.Context(), uid.String())
	if err != nil {
		return err
	}
	if user == nil {
		return apperr.ErrUnauthorized
	}

	user.Name = body.Name
	user.Image = nil
	if body.Image != "" {
		user.Image = &body.Image
	}
	// The timezone rides in Authula's user metadata, so /auth/me carries it.
	if body.Timezone != "" {
		if _, err := time.LoadLocation(body.Timezone); err != nil {
			return apperr.New(apperr.KindBadRequest, "%s isn't a known timezone", body.Timezone)
		}
		if user.Metadata == nil {
			user.Metadata = map[string]any{}
		}
		user.Metadata["timezone"] = body.Timezone
	}
	if user, err = users.Update(c.Context(), user); err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivityProfileUpdated, "Updated their profile", nil)
	return dtos.OK(c, user)
}

// UpdatePreferences changes the user's app preferences. They ride in Authula's
// user metadata like the timezone, so /auth/me carries them. Apart from Update
// because that one rewrites the name and the avatar from its body.
func (h *profileHandler) UpdatePreferences(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	var body dtos.PreferencesBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	users := h.app.Auth.CoreServices().UserService
	user, err := users.GetByID(c.Context(), uid.String())
	if err != nil {
		return err
	}
	if user == nil {
		return apperr.ErrUnauthorized
	}

	if body.SplitInbox != nil {
		if user.Metadata == nil {
			user.Metadata = map[string]any{}
		}
		user.Metadata["split_inbox"] = *body.SplitInbox
	}
	if user, err = users.Update(c.Context(), user); err != nil {
		return err
	}
	return dtos.OK(c, user)
}

// ChangePassword replaces the user's password after checking the current one,
// then ends every session, this one included: whoever knew the old password
// is signed out, and the user signs in again with the new one.
func (h *profileHandler) ChangePassword(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	var body dtos.PasswordBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	if len(body.NewPassword) < dtos.MinPasswordLen {
		return apperr.New(apperr.KindBadRequest, "the new password must be at least %d characters", dtos.MinPasswordLen)
	}

	services := h.app.Auth.CoreServices()
	account, err := services.AccountService.GetByUserIDAndProvider(c.Context(), uid.String(), authulamodels.AuthProviderEmail.String())
	if err != nil {
		return err
	}
	if account == nil || account.Password == nil {
		return apperr.New(apperr.KindBadRequest, "this account signs in without a password")
	}
	if !services.PasswordService.Verify(body.CurrentPassword, *account.Password) {
		return apperr.New(apperr.KindBadRequest, "the current password is wrong")
	}

	hash, err := services.PasswordService.Hash(body.NewPassword)
	if err != nil {
		return err
	}
	account.Password = &hash
	if _, err := services.AccountService.Update(c.Context(), account); err != nil {
		return err
	}
	// The API keys too, first: whoever knew the old password could have made
	// one, and a failure here must not leave them working behind ended sessions.
	if keys, ok := h.app.APIKeys(); ok {
		if err := keys.DeleteAllByOwner(c.Context(), userActor(uid), apikeyplugintypes.OwnerTypeUser, uid.String()); err != nil {
			return err
		}
	}
	if err := services.SessionService.DeleteAllByUserID(c.Context(), uid.String()); err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivityPasswordChanged, "Changed their password", nil)
	return dtos.Message(c, fiber.StatusOK, "password changed, sign in again")
}
