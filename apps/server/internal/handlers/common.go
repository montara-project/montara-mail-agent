package handlers

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/repositories"
)

// pathID parses the :id path parameter, naming the resource in the error so a
// malformed id reads as "invalid organization id".
func pathID(c fiber.Ctx, resource string) (uuid.UUID, error) {
	id, err := lib.ContextParamUUID(c, "id")
	if err != nil {
		return uuid.Nil, apperr.New(apperr.KindBadRequest, "invalid %s id", resource)
	}
	return id, nil
}

// listParams maps the clamped pagination query onto the repository controls.
func listParams(q dtos.ListQuery) repositories.ListParams {
	return repositories.ListParams{Offset: q.Offset, Limit: q.Limit, Search: q.Search, Sorted: q.Sorted}
}

// mutateByID runs a by-id write (delete, restore, permanent delete) on the
// :id path parameter and answers with the bare {message} envelope.
func mutateByID(c fiber.Ctx, resource string, fn func(context.Context, uuid.UUID) error, message string) error {
	id, err := pathID(c, resource)
	if err != nil {
		return err
	}
	if err := fn(c.Context(), id); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, message)
}

// isSuperUser reports whether uid is a super user; a user missing from the
// mirror is not.
func isSuperUser(ctx context.Context, app *app.Application, uid uuid.UUID) (bool, error) {
	role, err := app.Repositories.User.Role(ctx, uid)
	if apperr.IsNotFound(err) {
		return false, nil
	}
	return role == constant.RoleSuperUser, err
}

// errOrganizationNotFound answers non-members too, so the ids of other
// organizations reveal nothing.
var errOrganizationNotFound = apperr.New(apperr.KindNotFound, "organization not found")

// member checks that the signed-in user belongs to the organization or is a
// super user, and returns the user's role in it ("" for a super user who is
// no member).
func member(c fiber.Ctx, app *app.Application, organizationID uuid.UUID) (string, error) {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return "", apperr.ErrUnauthorized
	}

	role, err := app.Repositories.Organization.MemberRole(c.Context(), organizationID, uid)
	if !apperr.IsNotFound(err) {
		return role, err
	}
	super, err := isSuperUser(c.Context(), app, uid)
	if err != nil {
		return "", err
	}
	if !super {
		return "", errOrganizationNotFound
	}
	return "", nil
}

// owner checks that the signed-in user owns the organization or is a super user.
func owner(c fiber.Ctx, app *app.Application, organizationID uuid.UUID) error {
	role, err := member(c, app, organizationID)
	if err != nil {
		return err
	}
	if role == constant.MemberRoleMember {
		return apperr.New(apperr.KindForbidden, "only the organization's owner can do this")
	}
	return nil
}
