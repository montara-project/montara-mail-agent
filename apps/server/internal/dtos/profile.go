package dtos

import "montara-mail-agent/server/internal/lib/validator"

// ProfileBody changes the signed-in user's name and avatar; an empty image
// removes the avatar.
type ProfileBody struct {
	Name  string `json:"name"`
	Image string `json:"image"`
	// Timezone is an IANA name (e.g. Asia/Jakarta) the app shows times in;
	// empty keeps the saved one, which is UTC until set.
	Timezone string `json:"timezone"`
}

func (dto ProfileBody) Validate(v *validator.MapValidator) {
	v.Field("name").Required().String().MaxLen(maxNameLen)
	v.Field("image").String().MaxLen(2000).Regex(`^(https://\S+)?$`)
	v.Field("timezone").String().MaxLen(64).Regex(`^[A-Za-z][A-Za-z0-9_+/-]*$`)
}

// PreferencesBody changes the signed-in user's app preferences. A nil field
// keeps the saved value.
type PreferencesBody struct {
	// SplitInbox shows one account at a time instead of the global inbox.
	SplitInbox *bool `json:"split_inbox"`
}

func (dto PreferencesBody) Validate(v *validator.MapValidator) {}

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
