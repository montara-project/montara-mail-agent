package handlers

import (
	"strings"
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
	// HasGoogle is true for a user linked to Google sign-in.
	HasGoogle bool `json:"has_google"`
	// HasMicrosoft is true for a user linked to Microsoft sign-in.
	HasMicrosoft bool `json:"has_microsoft"`
	TOTPEnabled  bool `json:"totp_enabled"`
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
	google, err := h.app.Auth.CoreServices().AccountService.GetByUserIDAndProvider(c.Context(), uid.String(), authulamodels.AuthProviderGoogle.String())
	if err != nil {
		return err
	}
	// Matches microsoftProviderID in cmd/api, which Authula has no constant for.
	microsoft, err := h.app.Auth.CoreServices().AccountService.GetByUserIDAndProvider(c.Context(), uid.String(), "microsoft")
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
	return dtos.OK(c, security{HasPassword: account != nil && account.Password != nil, HasGoogle: google != nil, HasMicrosoft: microsoft != nil, TOTPEnabled: totp, SuperUser: super})
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
	if body.AgentPanel != nil && *body.AgentPanel != "" {
		if user.Metadata == nil {
			user.Metadata = map[string]any{}
		}
		user.Metadata["agent_panel"] = *body.AgentPanel
	}
	if user, err = users.Update(c.Context(), user); err != nil {
		return err
	}
	return dtos.OK(c, user)
}

// DeleteAccount deletes the signed-in user for good, once they type their own
// email: the API keys, the memberships, the organizations nobody else belongs
// to and the Authula rows all go (see UserRepository.Purge). The caller is
// signed out with everything else, since their sessions cascade away.
func (h *profileHandler) DeleteAccount(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	var body dtos.DeleteAccountBody
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
	if !strings.EqualFold(strings.TrimSpace(body.Email), user.Email) {
		return apperr.New(apperr.KindBadRequest, "the email doesn't match this account")
	}

	// The platform would be left unmanageable.
	if role, err := h.app.Repositories.User.Role(c.Context(), uid); err != nil {
		return err
	} else if role == constant.RoleSuperUser {
		others, err := h.app.Repositories.User.SuperUsersOtherThan(c.Context(), uid)
		if err != nil {
			return err
		}
		if others == 0 {
			return apperr.New(apperr.KindConflict, "this is the only super user; promote another one first")
		}
	}

	// Activity is recorded before the purge: this user's own log rows go with
	// the account, so the entry survives only in an organization's trail.
	recordActivity(c, h.app, uuid.Nil, constant.ActivityAccountDeleted, "Deleted their account", nil)

	// One transaction covers both schemas: the Authula row (its accounts,
	// sessions, keys and two-factor state cascade), the mirror row, and every
	// application row the account owned.
	if err := h.app.Repositories.User.Purge(c.Context(), uid); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "account deleted")
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
	// The API keys and passkeys go before the password changes: whoever knew
	// the old password could have made either, and a failure here must not
	// leave the new password in place with them still working. The change
	// then fails as a whole and can be tried again.
	if keys, ok := h.app.APIKeys(); ok {
		if err := keys.DeleteAllByOwner(c.Context(), userActor(uid), apikeyplugintypes.OwnerTypeUser, uid.String()); err != nil {
			return err
		}
	}
	if err := h.app.Passkeys.DeleteAll(c.Context(), uid); err != nil {
		return err
	}
	account.Password = &hash
	if _, err := services.AccountService.Update(c.Context(), account); err != nil {
		return err
	}
	// Sessions after the write, so none opened with the old password survives.
	if err := services.SessionService.DeleteAllByUserID(c.Context(), uid.String()); err != nil {
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivityPasswordChanged, "Changed their password", nil)
	return dtos.Message(c, fiber.StatusOK, "password changed, sign in again")
}

// Sessions lists where the user is signed in, the caller's own session marked.
func (h *profileHandler) Sessions(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	sessions, err := h.app.Repositories.User.Sessions(c.Context(), uid)
	if err != nil {
		return err
	}
	current := lib.ContextGetSessionID(c)
	for i := range sessions {
		sessions[i].Current = sessions[i].ID == current
	}
	return dtos.List(c, sessions, dtos.ListMeta(len(sessions), 0, len(sessions)))
}

// RevokeSession signs one of the user's sessions out. Revoking the caller's
// own session signs the caller out too.
func (h *profileHandler) RevokeSession(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	id, err := pathID(c, "session")
	if err != nil {
		return err
	}
	if err := h.app.Repositories.User.DeleteSession(c.Context(), uid, id); err != nil {
		if apperr.IsNotFound(err) {
			return apperr.New(apperr.KindNotFound, "session not found")
		}
		return err
	}
	recordActivity(c, h.app, uuid.Nil, constant.ActivitySessionRevoked, "Signed out a session", map[string]any{"session_id": id.String()})
	return dtos.Message(c, fiber.StatusOK, "session revoked")
}

// RevokeOtherSessions signs the user out everywhere but the caller's session.
func (h *profileHandler) RevokeOtherSessions(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	n, err := h.app.Repositories.User.DeleteOtherSessions(c.Context(), uid, lib.ContextGetSessionID(c))
	if err != nil {
		return err
	}
	if n > 0 {
		recordActivity(c, h.app, uuid.Nil, constant.ActivitySessionRevoked, "Signed out every other session", map[string]any{"count": n})
	}
	return dtos.Message(c, fiber.StatusOK, "other sessions revoked")
}
