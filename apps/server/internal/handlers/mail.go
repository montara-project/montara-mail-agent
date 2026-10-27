package handlers

import (
	"context"
	"errors"
	"fmt"
	"html"
	"strings"

	"github.com/gofiber/fiber/v3"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/lib/llm"
	"montara-mail-agent/server/internal/mailai"
	"montara-mail-agent/server/internal/mailsync"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type mailHandler struct {
	app  *app.Application
	sync *mailsync.Syncer
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

	// The app answers at once; the mail server gets the read and starred
	// states in the background, and a failure there only costs the next
	// sync's view of the flag.
	if body.IsRead != nil || body.IsStarred != nil {
		go func(m models.Mail) {
			account, err := h.app.Repositories.EmailAccount.Get(context.Background(), m.EmailAccountID)
			if err == nil {
				err = h.sync.SetFlags(context.Background(), account, m, body.IsRead, body.IsStarred)
			}
			if err != nil {
				h.app.Logger.Warn("mail flags not written to the server", "mail", m.ID, "error", err)
			}
		}(m)
	}

	m, err = h.repo().Get(c.Context(), m.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, m)
}

// account returns the account a mail belongs to.
func (h *mailHandler) account(c fiber.Ctx, m models.Mail) (models.EmailAccount, error) {
	return h.app.Repositories.EmailAccount.Get(c.Context(), m.EmailAccountID)
}

// serverError keeps typed errors (no such folder, stale folder) and reports
// anything else as the mail server's refusal.
func serverError(err error) error {
	var ae *apperr.Error
	if errors.As(err, &ae) {
		return err
	}
	return apperr.New(apperr.KindBadGateway, "the mail server refused: %v", err)
}

// Move moves a mail to the inbox, archive, spam or trash, on the server too.
func (h *mailHandler) Move(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	var body dtos.MailMoveBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	if body.Folder == m.Folder {
		return apperr.New(apperr.KindBadRequest, "the mail is already in %s", m.Folder)
	}

	account, err := h.account(c, m)
	if err != nil {
		return err
	}
	if err := h.sync.Move(c.Context(), account, m, body.Folder); err != nil {
		return serverError(err)
	}
	return dtos.Message(c, fiber.StatusOK, "mail moved to "+body.Folder)
}

// Delete moves a mail to the trash, or deletes it for good when it is already there.
func (h *mailHandler) Delete(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	account, err := h.account(c, m)
	if err != nil {
		return err
	}

	if m.Folder != constant.FolderTrash {
		if err := h.sync.Move(c.Context(), account, m, constant.FolderTrash); err != nil {
			return serverError(err)
		}
		return dtos.Message(c, fiber.StatusOK, "mail moved to trash")
	}
	if err := h.sync.Delete(c.Context(), account, m); err != nil {
		return serverError(err)
	}
	description := "Deleted a mail"
	if m.Subject != "" {
		description = fmt.Sprintf("Deleted %q", m.Subject)
	}
	recordActivity(c, h.app, account.OrganizationID, constant.ActivityMailDeleted, description,
		map[string]any{"subject": m.Subject, "from": m.FromEmail})
	return dtos.Message(c, fiber.StatusOK, "mail deleted")
}

// Forward sends the mail on from its account to other addresses.
func (h *mailHandler) Forward(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	var body dtos.MailForwardBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	account, err := h.account(c, m)
	if err != nil {
		return err
	}
	if err := h.sync.Forward(c.Context(), account, m, body.To, body.Note); err != nil {
		return serverError(err)
	}
	recordActivity(c, h.app, account.OrganizationID, constant.ActivityMailForwarded,
		mailSentence("Forwarded", m.Subject, body.To), map[string]any{"subject": m.Subject, "to": body.To})
	return dtos.Message(c, fiber.StatusOK, "mail forwarded")
}

// Reply sends a reply from the mail's account, by default to its sender.
func (h *mailHandler) Reply(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	var body dtos.MailReplyBody
	attachments, err := mailBody(c, &body)
	if err != nil {
		return err
	}

	to := body.To
	if len(to) == 0 {
		if m.FromEmail == "" {
			return apperr.New(apperr.KindBadRequest, "this email has no sender to reply to")
		}
		to = []string{m.FromEmail}
	}
	if len(to)+len(body.Cc) > dtos.MaxRecipients {
		return apperr.New(apperr.KindBadRequest, "a mail goes to at most %d addresses", dtos.MaxRecipients)
	}

	account, err := h.account(c, m)
	if err != nil {
		return err
	}
	// Without HTML from the editor, the text stands in, escaped.
	htmlBody := body.HTML
	if htmlBody == "" {
		htmlBody = `<div style="white-space:pre-wrap">` + html.EscapeString(body.Text) + "</div>"
	}
	if err := h.sync.Reply(c.Context(), account, m, to, body.Cc, body.Text, htmlBody, attachments); err != nil {
		return serverError(err)
	}
	recordActivity(c, h.app, account.OrganizationID, constant.ActivityMailReplied,
		fmt.Sprintf("Replied to %s", strings.Join(to, ", ")),
		map[string]any{"subject": m.Subject, "to": to})
	return dtos.Message(c, fiber.StatusOK, "reply sent")
}

// llmFor returns the model of the mail's organization.
func (h *mailHandler) llmFor(c fiber.Ctx, m models.Mail) (llm.Client, error) {
	account, err := h.account(c, m)
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
	summary, err := mailai.Summarize(c.Context(), client, m, nil)
	if err != nil {
		return h.aiError("summary", err)
	}
	if err := h.repo().SetSummary(c.Context(), m.ID, summary); err != nil {
		return err
	}
	return dtos.OK(c, fiber.Map{"summary": summary})
}

// ReplySuggestions returns up to three short replies to the mail. An optional
// body names the agent bot whose persona should write them.
func (h *mailHandler) ReplySuggestions(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	client, err := h.llmFor(c, m)
	if err != nil {
		return err
	}
	account, err := h.account(c, m)
	if err != nil {
		return err
	}
	// The body is optional: a client that sends none keeps the old behaviour.
	var body dtos.ReplySuggestionsBody
	if raw := c.Body(); len(raw) > 0 {
		if err := lib.ValidateJSON(raw, &body); err != nil {
			return err
		}
	}
	bot, err := orgBot(c, h.app, account.OrganizationID, body.AgentBotID)
	if err != nil {
		return err
	}
	suggestions, err := mailai.SuggestReplies(c.Context(), client, m, bot)
	if err != nil {
		return h.aiError("reply suggestions", err)
	}
	return dtos.OK(c, fiber.Map{"suggestions": suggestions})
}

// DraftReply writes a whole reply to the mail from the user's instruction,
// in the named agent bot's persona. Nothing is sent: the web app puts the
// text in the reply editor for the user to review.
func (h *mailHandler) DraftReply(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	var body dtos.DraftReplyBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	client, err := h.llmFor(c, m)
	if err != nil {
		return err
	}
	account, err := h.account(c, m)
	if err != nil {
		return err
	}
	bot, err := orgBot(c, h.app, account.OrganizationID, body.AgentBotID)
	if err != nil {
		return err
	}
	text, err := mailai.DraftReply(c.Context(), client, m, bot, body.Instruction)
	if err != nil {
		return h.aiError("reply draft", err)
	}
	return dtos.OK(c, fiber.Map{"text": text})
}

// RunSkill runs one skill on the mail and answers what it made: a summary, an
// importance label (saved on the mail), a reply draft for the editor, or a
// custom skill's Markdown. Nothing is sent. The persona is the skill's agent
// bot, else the one the user picked.
func (h *mailHandler) RunSkill(c fiber.Ctx) error {
	m, err := h.mail(c)
	if err != nil {
		return err
	}
	var body dtos.RunSkillBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}
	account, err := h.account(c, m)
	if err != nil {
		return err
	}
	skill, err := orgSkill(c, h.app, account.OrganizationID, c.Params("key"))
	if err != nil {
		return err
	}
	if !skill.IsEnabled {
		return apperr.New(apperr.KindConflict, "the skill %s is turned off", skill.Name)
	}
	skill.OrganizationID = account.OrganizationID
	bot, err := skillBot(c, h.app, skill, body.AgentBotID)
	if err != nil {
		return err
	}
	client, err := h.llmFor(c, m)
	if err != nil {
		return err
	}

	switch skill.Key() {
	case models.SkillSummarize:
		text, err := mailai.Summarize(c.Context(), client, m, bot)
		if err != nil {
			return h.aiError("summary", err)
		}
		// Only the built-in persona's summary is the mail's kept one.
		if bot == nil {
			if err := h.repo().SetSummary(c.Context(), m.ID, text); err != nil {
				return err
			}
		}
		return dtos.OK(c, fiber.Map{"kind": "summary", "text": text})
	case models.SkillOrganize:
		labels, err := mailai.Classify(c.Context(), client, []models.Mail{m})
		if err != nil {
			return h.aiError("organize", err)
		}
		label, ok := labels[0]
		if !ok {
			return apperr.New(apperr.KindBadGateway, "the AI gave no label for this email; try again")
		}
		if err := h.repo().ReplaceAIImportance(c.Context(), m.ID, label); err != nil {
			return err
		}
		return dtos.OK(c, fiber.Map{"kind": "organize", "importance": label})
	case models.SkillDraftReply:
		text, err := mailai.DraftReply(c.Context(), client, m, bot, body.Instruction)
		if err != nil {
			return h.aiError("reply draft", err)
		}
		return dtos.OK(c, fiber.Map{"kind": "reply", "text": text})
	}
	text, err := mailai.RunSkill(c.Context(), client, m, bot, skill)
	if err != nil {
		return h.aiError(skill.Name, err)
	}
	return dtos.OK(c, fiber.Map{"kind": "text", "text": text})
}
