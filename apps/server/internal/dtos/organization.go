package dtos

import "montara-mail-agent/server/internal/lib/validator"

// maxNameLen bounds a organization name; the column itself is unbounded.
const maxNameLen = 100

// OrganizationBody is the create/update payload for a organization.
type OrganizationBody struct {
	Name string `json:"name"`
}

func (dto OrganizationBody) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().MaxLen(maxNameLen)
}
