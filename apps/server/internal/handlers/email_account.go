package handlers

import (
	"cmp"
	"context"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/dtos"
	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/mailsync"
	"montara-mail-agent/server/internal/models"
	"montara-mail-agent/server/internal/repositories"
)

type emailAccountHandler struct {
	app  *app.Application
	sync *mailsync.Syncer
}

func (h *emailAccountHandler) repo() *repositories.EmailAccountRepository {
	return &h.app.Repositories.EmailAccount
}

// account loads the :id account, for members of its organization only.
func (h *emailAccountHandler) account(c fiber.Ctx) (models.EmailAccount, error) {
	id, err := pathID(c, "email account")
	if err != nil {
		return models.EmailAccount{}, err
	}
	account, err := h.repo().Get(c.Context(), id)
	if err != nil {
		return account, err
	}
	if _, err := member(c, h.app, account.OrganizationID); err != nil {
		if err == errOrganizationNotFound {
			// Same answer as a missing account.
			err = apperr.New(apperr.KindNotFound, "record not found in email_accounts")
		}
		return models.EmailAccount{}, err
	}
	return account, nil
}

// List returns the organization's accounts with their unread and spam counts.
func (h *emailAccountHandler) List(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, organizationID); err != nil {
		return err
	}

	accounts, err := h.repo().ListByOrganization(c.Context(), organizationID)
	if err != nil {
		return err
	}
	return dtos.List(c, accounts, dtos.ListMeta(len(accounts), 0, len(accounts)))
}

// Create connects a mailbox: it signs in first, so wrong credentials are
// refused, then saves the account and syncs it in the background.
func (h *emailAccountHandler) Create(c fiber.Ctx) error {
	organizationID, err := pathID(c, "organization")
	if err != nil {
		return err
	}
	if _, err := member(c, h.app, organizationID); err != nil {
		return err
	}

	var body dtos.EmailAccountBody
	if err := lib.ValidateRequestBody(c, &body); err != nil {
		return err
	}

	account := models.EmailAccount{
		OrganizationID: organizationID,
		Provider:       body.Provider,
		Email:          strings.TrimSpace(body.Email),
		Label:          strings.TrimSpace(body.Label),
		Username:       strings.TrimSpace(body.Username),
	}
	if servers, ok := constant.ProviderServers[body.Provider]; ok {
		account.IMAPHost, account.IMAPPort = servers.IMAP.Host, servers.IMAP.Port
		account.SMTPHost, account.SMTPPort = servers.SMTP.Host, servers.SMTP.Port
	} else {
		if body.IMAPHost == "" {
			return apperr.New(apperr.KindBadRequest, "imap_host is required for a custom IMAP account")
		}
		account.IMAPHost, account.IMAPPort = body.IMAPHost, cmp.Or(body.IMAPPort, 993)
		account.SMTPHost = cmp.Or(body.SMTPHost, "smtp."+strings.TrimPrefix(body.IMAPHost, "imap."))
		account.SMTPPort = cmp.Or(body.SMTPPort, 465)
	}
	if account.Username == "" {
		account.Username = account.Email
	}
	if account.Label == "" {
		account.Label = account.Email
	}

	if err := h.sync.Verify(c.Context(), account.IMAPHost, account.IMAPPort, account.Username, body.Password); err != nil {
		return apperr.New(apperr.KindBadRequest, "couldn't connect to the mailbox: %v", err)
	}

	account.Password = h.app.Secrets.Seal(body.Password)
	if account.ID, err = uuid.NewV7(); err != nil {
		return err
	}
	if err := h.repo().Insert(c.Context(), account); err != nil {
		return err
	}

	account, err = h.repo().Get(c.Context(), account.ID)
	if err != nil {
		return err
	}
	// The first sync takes a while; the client polls the account list.
	go func() {
		if err := h.sync.Sync(context.Background(), account); err != nil {
			h.app.Logger.Warn("first mail sync failed", "account", account.ID, "error", err)
		}
	}()
	return dtos.Created(c, account, "email account connected")
}

// Delete disconnects an account and drops its synced mail.
func (h *emailAccountHandler) Delete(c fiber.Ctx) error {
	account, err := h.account(c)
	if err != nil {
		return err
	}
	if err := h.repo().Delete(c.Context(), account.ID); err != nil {
		return err
	}
	return dtos.Message(c, fiber.StatusOK, "email account disconnected")
}

// Sync pulls the account's new mail now.
func (h *emailAccountHandler) Sync(c fiber.Ctx) error {
	account, err := h.account(c)
	if err != nil {
		return err
	}
	if err := h.sync.Sync(c.Context(), account); err != nil {
		return apperr.New(apperr.KindBadGateway, "sync failed: %v", err)
	}

	account, err = h.repo().Get(c.Context(), account.ID)
	if err != nil {
		return err
	}
	return dtos.OK(c, account)
}

// Mails lists one folder of the account, newest first, with the folder's
// unread count in the metadata.
func (h *emailAccountHandler) Mails(c fiber.Ctx) error {
	account, err := h.account(c)
	if err != nil {
		return err
	}

	var q dtos.MailListQuery
	if err := lib.ValidateRequestQuery(c, &q); err != nil {
		return err
	}
	q.Clamp()
	if q.Folder == "" {
		q.Folder = constant.FolderInbox
	}

	params := repositories.MailListParams{ListParams: listParams(q.ListQuery), Folder: q.Folder, Importance: q.Importance}
	repo := &h.app.Repositories.Mail

	mails, err := repo.List(c.Context(), account.ID, params)
	if err != nil {
		return err
	}
	total, err := repo.Count(c.Context(), account.ID, params)
	if err != nil {
		return err
	}
	unread, err := repo.Unread(c.Context(), account.ID, q.Folder)
	if err != nil {
		return err
	}

	meta := dtos.ListMeta(int(total), q.Offset, q.Limit)
	meta["unread"] = unread
	return dtos.List(c, mails, meta)
}
