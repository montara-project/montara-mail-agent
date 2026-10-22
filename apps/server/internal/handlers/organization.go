package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type organizationHandler struct {
	app *app.Application
}

func (h *organizationHandler) repo() *repositories.OrganizationRepository {
	return &h.app.Repositories.Organization
}

func (h *organizationHandler) List(c fiber.Ctx) error {
	var q dtos.ListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()

	params := listParams(q)

	organizations, err := h.repo().List(c.Context(), params)
	if err != nil {
		return err
	}
	total, err := h.repo().Count(c.Context(), params)
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

	organization, err := h.repo().Get(c.Context(), id)
	if err != nil {
		return err
	}
	return dtos.Get(c, organization)
}

func (h *organizationHandler) Create(c fiber.Ctx) error {
	var body dtos.OrganizationBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	organization := models.Organization{Name: body.Name}
	var err error
	if organization.ID, err = uuid.NewV7(); err != nil {
		return err
	}

	if err := h.repo().Insert(c.Context(), organization); err != nil {
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

func (h *organizationHandler) Delete(c fiber.Ctx) error {
	return mutateByID(c, "organization", h.repo().Delete, "organization deleted")
}

func (h *organizationHandler) Restore(c fiber.Ctx) error {
	return mutateByID(c, "organization", h.repo().Restore, "organization restored")
}

func (h *organizationHandler) DeletePermanently(c fiber.Ctx) error {
	return mutateByID(c, "organization", h.repo().ForceDelete, "organization permanently deleted")
}
