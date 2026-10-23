package handlers

import (
	authulamodels "github.com/Authula/authula/models"
	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
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
	return dtos.OK(c, security{HasPassword: account != nil && account.Password != nil, TOTPEnabled: totp})
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
	if err := services.SessionService.DeleteAllByUserID(c.Context(), uid.String()); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "password changed, sign in again")
}
