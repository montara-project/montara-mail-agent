package handlers

import (
	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/repositories"
)

// activityLogHandler serves the activity log: what the signed-in user did,
// and what happened inside one of their organizations.
type activityLogHandler struct {
	app *app.Application
}

// ListMine returns the signed-in user's own activities, newest first.
func (h *activityLogHandler) ListMine(c fiber.Ctx) error {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	return h.list(c, repositories.ActivityLogScope{UserID: uid})
}

// ListByOrganization returns an organization's activities; members and super
// users only.
func (h *activityLogHandler) ListByOrganization(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, organizationID); err != nil {
		return err
	}
	return h.list(c, repositories.ActivityLogScope{OrganizationID: organizationID})
}

// list answers one page of entries for the scope, newest first.
func (h *activityLogHandler) list(c fiber.Ctx, scope repositories.ActivityLogScope) error {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()
	params := listParams(q)

	logs, err := h.app.Repositories.ActivityLog.List(c.Context(), params, scope)
	if err != nil {
		return err
	}
	total, err := h.app.Repositories.ActivityLog.Count(c.Context(), params, scope)
	if err != nil {
		return err
	}
	return dtos.List(c, logs, dtos.ListMeta(int(total), q.Offset, q.Limit))
}
