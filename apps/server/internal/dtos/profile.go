package dtos

import "montara-mail-agent/server/internal/lib/validator"

// ProfileBody changes the signed-in user's name and avatar; an empty image
// removes the avatar.
type ProfileBody struct {
	Name  string `json:"name"`
	Image string `json:"image"`
}

func (dto ProfileBody) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().MaxLen(maxNameLen)
	v.Field("image").String().MaxLen(2000).Regex(`^(https://\S+)?$`)
}

// Password bounds, the same as Authula's sign-up (see newAuth).
const (
	MinPasswordLen = 8
	MaxPasswordLen = 128
)

// PasswordBody changes the signed-in user's password.
type PasswordBody struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (dto PasswordBody) Validate(v *validator.MapValidator) {
	v.Field("current_password").Required().String().MaxLen(MaxPasswordLen)
	v.Field("new_password").Required().String().MaxLen(MaxPasswordLen)
}
