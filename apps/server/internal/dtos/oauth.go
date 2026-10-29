package dtos

import "montara-mail-agent/server/internal/lib/validator"

// OAuthFinishBody finishes an OAuth connection: the code and state the
// provider's callback handed back to the web app.
type OAuthFinishBody struct {
	Code  string `json:"code"`
	State string `json:"state"`
}

func (dto OAuthFinishBody) Validate(v *validator.MapValidator) {
	v.Field("code").Required().String().MaxLen(4096)
	v.Field("state").Required().String().MaxLen(4096)
}
