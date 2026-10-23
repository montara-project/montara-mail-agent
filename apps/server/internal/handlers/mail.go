package handlers

import (
	"errors"

	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/mailai"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type mailHandler struct {
	app *app.Application
}

func (h *mailHandler) repo() *repositories.MailRepository {
	return &h.app.Repositories.Mail
}

// mail loads the :id mail, for members of its organization only.
func (h *mailHandler) mail(c fiber.Ctx) (models.Mail, error) {
	id, err := pathID(c, "mail")
	if err != nil {
		return models.Mail{}, err
	}
	organizationID, err := h.repo().OrganizationOf(c.Context(), id)
	if err != nil {
		return models.Mail{}, err
	}
	if _, err := member(c, h.app, organizationID); err != nil {
		if err == errOrganizationNotFound {
			// Same answer as a missing mail.
			err = apperr.New(apperr.KindNotFound, "record not found in mails")
		}
		return models.Mail{}, err
	}
	return h.repo().Get(c.Context(), id)
}

func (h *mailHandler) Get(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	return dtos.Get(c, m)
}

// Patch marks a mail read or starred, or sets its importance as the user's choice.
func (h *mailHandler) Patch(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}

	var body dtos.MailPatchBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	patch := repositories.MailPatch{IsRead: body.IsRead, IsStarred: body.IsStarred, Importance: body.Importance}
	if err := h.repo().Patch(c.Context(), m.ID, patch); err != nil {
		return err
	}

	m, err = h.repo().Get(c.Context(), m.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, m)
}

// llmFor returns the model of the mail's organization.
func (h *mailHandler) llmFor(c fiber.Ctx, m models.Mail) (llm.Client, error) {
	account, err := h.app.Repositories.EmailAccount.Get(c.Context(), m.EmailAccountID)
	if err != nil {
		return nil, err
	}
	return h.app.LLMFor(c.Context(), account.OrganizationID)
}

// aiError maps a failed model call onto the answer, logging the cause.
func (h *mailHandler) aiError(task string, err error) error {
	if errors.Is(err, llm.ErrRefused) {
		return apperr.New(apperr.KindBadRequest, "the AI declined this email")
	}
	h.app.Logger.Error("mail "+task+": model call failed", "error", err)
	return apperr.New(apperr.KindBadGateway, "AI %s failed, try again", task)
}

// Summary returns the mail's AI summary, computed once and then kept.
func (h *mailHandler) Summary(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	if m.Summary != nil {
		return dtos.OK(c, fiber.Map{"summary": *m.Summary})
	}

	client, err := h.llmFor(c, m)
	if err != nil {
		return err
	}
	summary, err := mailai.Summarize(c.Context(), client, m)
	if err != nil {
		return h.aiError("summary", err)
	}
	if err := h.repo().SetSummary(c.Context(), m.ID, summary); err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"summary": summary})
}

// ReplySuggestions returns up to three short replies to the mail.
func (h *mailHandler) ReplySuggestions(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	client, err := h.llmFor(c, m)
	if err != nil {
		return err
	}
	suggestions, err := mailai.SuggestReplies(c.Context(), client, m)
	if err != nil {
		return h.aiError("reply suggestions", err)
	}
	return dtos.OK(c, fiber.Map{"suggestions": suggestions})
}
