package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path"
	"strings"
	"unicode"

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

// pathID parses the :id path parameter, naming the resource in the error so a
// malformed id reads as "invalid organization id".
func pathID(c fiber.Ctx, resource string) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, apperr.New(apperr.KindBadRequest, "invalid %s id", resource)
	}
	return id, nil
}

// listParams maps the clamped pagination query onto the repository controls.
func listParams(q dtos.ListQuery) repositories.ListParams {
	return repositories.ListParams{Offset: q.Offset, Limit: q.Limit, Search: q.Search, Sorted: q.Sorted}
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
// no member). An organization in the trash reads as missing: its mailboxes
// and mail are out of reach until it is restored.
func member(c fiber.Ctx, app *app.Application, organizationID uuid.UUID) (string, error) {
	role, err := memberOfAny(c, app, organizationID)
	if err != nil {
		return role, err
	}
	_, err = app.Repositories.Organization.Get(c.Context(), organizationID)
	if apperr.IsNotFound(err) {
		return "", errOrganizationNotFound
	}
	if err != nil {
		return "", err
	}
	return role, nil
}

// memberOfAny is member for an organization in the trash too: restoring it
// or deleting it for good.
func memberOfAny(c fiber.Ctx, app *app.Application, organizationID uuid.UUID) (string, error) {
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
	return ownerRole(role)
}

// ownerOfAny is owner for an organization in the trash too.
func ownerOfAny(c fiber.Ctx, app *app.Application, organizationID uuid.UUID) error {
	role, err := memberOfAny(c, app, organizationID)
	if err != nil {
		return err
	}
	return ownerRole(role)
}

func ownerRole(role string) error {
	if role == constant.MemberRoleMember {
		return apperr.New(apperr.KindForbidden, "only the organization's owner can do this")
	}
	return nil
}

// recordActivity stores an activity entry for the signed-in user, naming the
// organization the action happened in when it did. Best effort: a failed
// write is logged by the repository, never fails the action it witnesses.
func recordActivity(c fiber.Ctx, app *app.Application, organizationID uuid.UUID, action, description string, metadata map[string]any) {
	uid, err := lib.ContextGetUID(c)
	if err != nil {
		return
	}
	entry := models.ActivityLog{
		UserID:      &uid,
		Action:      action,
		Description: description,
		IP:          c.IP(),
		UserAgent:   c.Get(fiber.HeaderUserAgent),
	}
	if organizationID != uuid.Nil {
		entry.OrganizationID = &organizationID
	}
	if len(metadata) > 0 {
		if meta, err := json.Marshal(metadata); err == nil {
			entry.Metadata = meta
		}
	}
	app.Repositories.ActivityLog.Record(c.Context(), entry)
}

// mailSentence describes an outbound mail action for the activity log, with
// the subject when the mail has one.
func mailSentence(verb, subject string, to []string) string {
	recipients := strings.Join(to, ", ")
	if subject == "" {
		return fmt.Sprintf("%s a mail to %s", verb, recipients)
	}
	return fmt.Sprintf("%s %q to %s", verb, subject, recipients)
}

// mailBody reads the body of a send or a reply: JSON, or, to carry files, a
// multipart form with that JSON in "payload" and the files in "attachments".
func mailBody(c fiber.Ctx, obj lib.Validatable) ([]mailsync.Attachment, error) {
	if !strings.HasPrefix(c.Get(fiber.HeaderContentType), fiber.MIMEMultipartForm) {
		return nil, lib.ValidateRequestBody(c, obj)
	}
	form, err := c.MultipartForm()
	if err != nil {
		return nil, apperr.New(apperr.KindBadRequest, "invalid form")
	}
	var payload string
	if values := form.Value["payload"]; len(values) > 0 {
		payload = values[0]
	}
	if err := lib.ValidateJSON([]byte(payload), obj); err != nil {
		return nil, err
	}

	files := form.File["attachments"]
	if len(files) > dtos.MaxAttachments {
		return nil, apperr.New(apperr.KindBadRequest, "a mail carries at most %d attachments", dtos.MaxAttachments)
	}
	var total int64
	for _, f := range files {
		total += f.Size
	}
	if total > dtos.MaxAttachmentBytes {
		return nil, apperr.New(apperr.KindBadRequest, "attachments may total at most %d MB", dtos.MaxAttachmentBytes>>20)
	}

	attachments := make([]mailsync.Attachment, 0, len(files))
	for _, f := range files {
		file, err := f.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			return nil, err
		}
		attachments = append(attachments, mailsync.Attachment{
			Name:        attachmentName(f.Filename),
			ContentType: attachmentType(f.Header.Get(fiber.HeaderContentType), data),
			Data:        data,
		})
	}
	return attachments, nil
}

// attachmentName keeps the last path segment of an uploaded file's name,
// without control characters that could break the mail's headers.
func attachmentName(name string) string {
	name = path.Base(strings.ReplaceAll(name, `\`, "/"))
	name = strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, name))
	if name == "" || name == "." || name == "/" {
		return "attachment"
	}
	if r := []rune(name); len(r) > 200 {
		name = string(r[:200])
	}
	return name
}

// attachmentType is the media type the browser sent, else one sniffed from the data.
func attachmentType(header string, data []byte) string {
	if mediaType, _, err := mime.ParseMediaType(header); err == nil && strings.Contains(mediaType, "/") {
		return mediaType
	}
	mediaType, _, _ := mime.ParseMediaType(http.DetectContentType(data))
	return mediaType
}
