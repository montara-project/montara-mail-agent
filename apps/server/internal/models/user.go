package models

import "time"

// User mirrors the Authula user of the same id (see migration 000002) and
// adds the application role.
type User struct {
	Base
	Name  string  `db:"name" json:"name"`
	Email string  `db:"email" json:"email"`
	Image *string `db:"image" json:"image"`
	Role  string  `db:"role" json:"role"`
	Plan  string  `db:"plan" json:"plan"`
}

// Session is one of a user's Authula sign-ins, as the settings page lists it.
type Session struct {
	ID        string    `json:"id"`
	IPAddress *string   `json:"ip_address"`
	UserAgent *string   `json:"user_agent"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	ExpiresAt time.Time `json:"expires_at"`
	// Current marks the session the request came with.
	Current bool `json:"current"`
}
