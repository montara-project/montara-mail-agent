package handlers

import (
	"context"
	"fmt"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type organizationHandler struct {
	app *app.Application
}

func (h *organizationHandler) repo() *repositories.OrganizationRepository {
	return &h.app.Repositories.Organization
}

// List returns the signed-in user's organizations; a super user sees all.
func (h *organizationHandler) List(c fiber.Ctx) error {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}
	super, err := isSuperUser(c.Context(), h.app, uid)
	if err != nil {
		return err
	}
	memberID := uid
	if super {
		memberID = uuid.Nil
	}

	params := listParams(q)

	organizations, err := h.repo().List(c.Context(), params, memberID)
	if err != nil {
		return err
	}
	total, err := h.repo().Count(c.Context(), params, memberID)
	if err != nil {
		return err
	}

	return dtos.List(c, organizations, dtos.ListMeta(int(total), q.Offset, q.Limit))
}

func (h *organizationHandler) Get(c fiber.Ctx) error {
	id, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, id); err != nil {
		return err
	}

	organization, err := h.repo().Get(c.Context(), id)
	if err != nil {
		return err
	}
	return dtos.Get(c, organization)
}

// Create makes a new organization owned by the signed-in user.
func (h *organizationHandler) Create(c fiber.Ctx) error {
	var body dtos.OrganizationBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return apperr.ErrUnauthorized
	}

	organization := models.Organization{Name: body.Name}
	if organization.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	if err := h.repo().Insert(c.Context(), organization, uid); err != nil {
		return err
	}

	// Re-read so the response carries the DB-set timestamps.
	organization, err = h.repo().Get(c.Context(), organization.ID)
	if err != nil {
		return err
	}
	recordActivity(c, h.app, organization.ID, constant.ActivityOrganizationCreated,
		fmt.Sprintf("Created the organization %q", organization.Name), nil)
	return dtos.Created(c, organization, "organization created")
}

func (h *organizationHandler) Update(c fiber.Ctx) error {
	id, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if err := owner(c, h.app, id); err != nil {
		return err
	}

	var body dtos.OrganizationBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	organization := models.Organization{Name: body.Name}
	organization.ID = id

	if err := h.repo().Update(c.Context(), organization); err != nil {
		return err
	}

	organization, err = h.repo().Get(c.Context(), id)
	if err != nil {
		return err
	}
	recordActivity(c, h.app, id, constant.ActivityOrganizationUpdated,
		fmt.Sprintf("Renamed the organization to %q", organization.Name), nil)
	return dtos.OK(c, organization)
}

// mutateLogged runs an owner-guarded by-id write, records it in the activity
// log naming the organization when readable, then answers with {message}.
func (h *organizationHandler) mutateLogged(c fiber.Ctx, action, verb string, fn func(context.Context, uuid.UUID) error, message string) error {
	id, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if err := owner(c, h.app, id); err != nil {
		return err
	}
	name := ""
	if org, err := h.repo().Get(c.Context(), id); err == nil {
		name = org.Name
	}
	if err := fn(c.Context(), id); err != nil {
		return err
	}
	recordActivity(c, h.app, id, action, orgSentence(verb, name), nil)
	return dtos.Message(c, fiber.StatusOK, message)
}

// orgSentence names the organization an entry is about, when known.
func orgSentence(verb, name string) string {
	if name == "" {
		return verb + " the organization"
	}
	return fmt.Sprintf("%s the organization %q", verb, name)
}

func (h *organizationHandler) Delete(c fiber.Ctx) error {
	return h.mutateLogged(c, constant.ActivityOrganizationDeleted, "Deleted", h.repo().Delete, "organization deleted")
}

func (h *organizationHandler) Restore(c fiber.Ctx) error {
	return h.mutateLogged(c, constant.ActivityOrganizationRestored, "Restored", h.repo().Restore, "organization restored")
}

func (h *organizationHandler) DeletePermanently(c fiber.Ctx) error {
	return h.mutateLogged(c, constant.ActivityOrganizationPurged, "Permanently deleted", h.repo().ForceDelete, "organization permanently deleted")
}

// Stats returns the dashboard totals: unread inbox mail, spam and connected accounts.
func (h *organizationHandler) Stats(c fiber.Ctx) error {
	id, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, id); err != nil {
		return err
	}

	stats, err := h.app.Repositories.EmailAccount.Stats(c.Context(), id)
	if err != nil {
		return err
	}
	return dtos.Get(c, stats)
}
