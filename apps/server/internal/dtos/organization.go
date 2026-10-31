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

// OrganizationListQuery is the organization list binding. `member=1` limits
// the list to the caller's memberships even for a super user, who otherwise
// sees every organization; a plain user is always limited to their own.
type OrganizationListQuery struct {
	ListQuery

	Member string `query:"member"`
}

func (dto OrganizationListQuery) Validate(v *validator.MapValidator) {
	dto.base(v)
	v.Field("member").Regex(`^(1|true)?$`)
}
