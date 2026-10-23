package dtos

import "montara-mail-agent/server/internal/lib/validator"

// EmailAccountBody connects a mailbox over IMAP. Known providers have fixed
// servers; the custom "imap" provider names its own. Username defaults to
// the email address.
type EmailAccountBody struct {
	Provider string `json:"provider"`
	Label    string `json:"label"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
	IMAPHost string `json:"imap_host"`
	IMAPPort int    `json:"imap_port"`
	// SMTP is for custom IMAP accounts too; it defaults to the IMAP host
	// with "smtp." in front, on 465.
	SMTPHost string `json:"smtp_host"`
	SMTPPort int    `json:"smtp_port"`
}

func (dto EmailAccountBody) Validate(v *validator.MapValidator) {
	v.Field("provider").Required().Regex(`^(gmail|outlook|yahoo|icloud|imap)$`)
	v.Field("label").String().MaxLen(maxNameLen)
	v.Field("email").Required().String().MaxLen(320).Regex(`^[^@\s]+@[^@\s]+$`)
	v.Field("username").String().MaxLen(320)
	v.Field("password").Required().String().MaxLen(1000)
	v.Field("imap_host").String().MaxLen(253).Regex(`^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$`)
	v.Field("imap_port").IntRange(1, 65535)
	v.Field("smtp_host").String().MaxLen(253).Regex(`^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$`)
	v.Field("smtp_port").IntRange(1, 65535)
}
