package handlers

import (
	"context"
	"time"

	authulamodels "github.com/Authula/authula/models"
	authulaservices "github.com/Authula/authula/services"

	"montara-mail-agent/server/internal/lib/apperr"
)

// RecentSignIn is how fresh the session of a user without a password must be
// to add a new way to sign in.
const RecentSignIn = 10 * time.Minute

// ConfirmIdentity checks the caller again before they add a passkey or an
// authenticator app, so a stolen access token alone can't plant a lasting way
// in: the password for a user who has one, else a sign-in within RecentSignIn
// (a Google, Microsoft or magic-link user has no password to confirm).
func ConfirmIdentity(ctx context.Context, core *authulaservices.CoreServices, userID, sessionID, password string) error {
	account, err := core.AccountService.GetByUserIDAndProvider(ctx, userID, authulamodels.AuthProviderEmail.String())
	if err != nil {
		return err
	}
	if account != nil && account.Password != nil {
		if password == "" {
			return apperr.New(apperr.KindBadRequest, "confirm your password")
		}
		if !core.PasswordService.Verify(password, *account.Password) {
			return apperr.New(apperr.KindBadRequest, "the password is wrong")
		}
		return nil
	}

	if sessionID != "" {
		session, err := core.SessionService.GetByID(ctx, sessionID)
		if err != nil {
			return err
		}
		if session != nil && session.UserID == userID && time.Since(session.CreatedAt) <= RecentSignIn {
			return nil
		}
	}
	return apperr.New(apperr.KindForbidden, "sign in again to continue")
}
