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
	v.Field("folder").Regex(`^(inbox|sent|drafts|spam|trash)$`)
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
