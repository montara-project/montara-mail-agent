package dtos

import "montara-mail-agent/server/internal/lib/validator"

// MailListQuery lists one folder of an account, optionally by importance.
type MailListQuery struct {
	ListQuery
	Folder     string `query:"folder"`
	Importance string `query:"importance"`
}

func (dto MailListQuery) Validate(v *validator.MapValidator) {
	dto.base(v)
	v.Field("folder").Regex(`^(inbox|archive|sent|drafts|spam|trash)$`)
	v.Field("importance").Regex(`^(important|low_priority)$`)
}

// MailPatchBody changes a mail; absent fields stay as they are.
type MailPatchBody struct {
	IsRead     *bool   `json:"is_read"`
	IsStarred  *bool   `json:"is_starred"`
	Importance *string `json:"importance"`
}

func (dto MailPatchBody) Validate(v *validator.MapValidator) {
	v.Field("importance").Regex(`^(important|low_priority)$`)
}

// MailMoveBody names the folder a mail moves to.
type MailMoveBody struct {
	Folder string `json:"folder"`
}

func (dto MailMoveBody) Validate(v *validator.MapValidator) {
	v.Field("folder").Required().Regex(`^(inbox|archive|spam|trash)$`)
}

// MaxRecipients bounds one outgoing mail (all of To and Cc together), so an
// account can't become a mass mailer.
const MaxRecipients = 20

// emailPattern is a plain address, with no display name or list separators.
const emailPattern = `^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$`

// MailForwardBody forwards a mail to up to 20 addresses with an optional note.
type MailForwardBody struct {
	To   []string `json:"to"`
	Note string   `json:"note"`
}

func (dto MailForwardBody) Validate(v *validator.MapValidator) {
	v.Field("to").Required().ArrayOf(MaxRecipients, emailPattern)
	v.Field("note").String().MaxLen(10000)
}

// MailReplyBody is a reply to a mail's sender: its text (Markdown, as typed)
// and the HTML the editor made of it.
type MailReplyBody struct {
	Text string `json:"text"`
	HTML string `json:"html"`
}

func (dto MailReplyBody) Validate(v *validator.MapValidator) {
	v.Field("text").Required().String().MaxLen(100000)
	v.Field("html").String().MaxLen(500000)
}

// MailSendBody is a new mail from an account: its recipients, subject, and
// body as text (Markdown, as typed) and as the HTML the editor made.
type MailSendBody struct {
	To      []string `json:"to"`
	Cc      []string `json:"cc"`
	Subject string   `json:"subject"`
	Text    string   `json:"text"`
	HTML    string   `json:"html"`
}

func (dto MailSendBody) Validate(v *validator.MapValidator) {
	v.Field("to").Required().ArrayOf(MaxRecipients, emailPattern)
	v.Field("cc").ArrayOf(MaxRecipients, emailPattern)
	v.Field("subject").String().MaxLen(998)
	v.Field("text").Required().String().MaxLen(100000)
	v.Field("html").String().MaxLen(500000)
}
