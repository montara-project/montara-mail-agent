package dtos

import "montara-mail-agent/server/internal/lib/validator"

// maxMailBodyLen bounds the mail text sent to the model, about 12k tokens.
const maxMailBodyLen = 50000

// MailSummaryBody is the mail to summarize.
type MailSummaryBody struct {
	Subject string `json:"subject"`
	From    string `json:"from"`
	Body    string `json:"body"`
}

func (dto MailSummaryBody) Validate(v *validator.MapValidator) {
	v.Field("subject").String().MaxLen(500)
	v.Field("from").Required().String().MaxLen(500)
	v.Field("body").Required().String().MaxLen(maxMailBodyLen)
}
