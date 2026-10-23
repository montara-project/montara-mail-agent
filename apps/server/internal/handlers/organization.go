package handlers

import (
	"context"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
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
	return dtos.OK(c, organization)
}

// asOwner runs fn only for the organization's owner or a super user.
func (h *organizationHandler) asOwner(c fiber.Ctx, fn func(context.Context, uuid.UUID) error) func(context.Context, uuid.UUID) error {
	return func(ctx context.Context, id uuid.UUID) error {
		if err := owner(c, h.app, id); err != nil {
			return err
		}
		return fn(ctx, id)
	}
}

func (h *organizationHandler) Delete(c fiber.Ctx) error {
	return mutateByID(c, "organization", h.asOwner(c, h.repo().Delete), "organization deleted")
}

func (h *organizationHandler) Restore(c fiber.Ctx) error {
	return mutateByID(c, "organization", h.asOwner(c, h.repo().Restore), "organization restored")
}

func (h *organizationHandler) DeletePermanently(c fiber.Ctx) error {
	return mutateByID(c, "organization", h.asOwner(c, h.repo().ForceDelete), "organization permanently deleted")
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
