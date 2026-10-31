package repositories

import (
	"context"

	"montara-mail-agent/server/internal/models"

	"github.com/google/uuid"
)

// UserRepository manages the public mirror of Authula's users. Authula owns
// the source rows; this table follows them and adds the application role.
type UserRepository struct {
	BaseRepository
}

// Upsert copies an Authula user into the mirror, inserting or refreshing it.
// The role is left alone: a new row gets the column default.
func (r *UserRepository) Upsert(ctx context.Context, u models.User) error {
	_, err := r.execContext(ctx, `
		INSERT INTO users (id, name, email, image)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE
		SET name = EXCLUDED.name, email = EXCLUDED.email, image = EXCLUDED.image, updated_at = now()`,
		u.ID, u.Name, u.Email, u.Image,
	)
	return err
}

// Reconcile copies every Authula user into the mirror, repairing rows a
// failed hook left missing or stale. Mirror rows of users deleted in Authula
// are kept: they can no longer sign in, and deleting here would wipe the
// roles if Authula ever pointed at the wrong schema.
// ponytail: runs once per boot; a trigger on authula.users would keep the
// mirror exact if drift between boots ever matters.
func (r *UserRepository) Reconcile(ctx context.Context) error {
	_, err := r.execContext(ctx, `
		INSERT INTO users (id, name, email, image)
		SELECT id, name, email, image FROM authula.users
		ON CONFLICT (id) DO UPDATE
		SET name = EXCLUDED.name, email = EXCLUDED.email, image = EXCLUDED.image, updated_at = now()
		WHERE (users.name, users.email, users.image) IS DISTINCT FROM (EXCLUDED.name, EXCLUDED.email, EXCLUDED.image)`)
	return err
}

// HasOtherThan reports whether Authula holds any account besides email.
func (r *UserRepository) HasOtherThan(ctx context.Context, email string) (bool, error) {
	var found bool
	err := r.queryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM authula.users WHERE lower(email) <> lower($1))`, email).Scan(&found)
	return found, err
}

// SetRole changes a mirrored user's role.
func (r *UserRepository) SetRole(ctx context.Context, id uuid.UUID, role string) error {
	res, err := r.execContext(ctx, `UPDATE users SET role = $2, updated_at = now() WHERE id = $1`, id, role)
	if err != nil {
		return err
	}
	return requireAffected(res, "user")
}

// Role returns a mirrored user's role.
func (r *UserRepository) Role(ctx context.Context, id uuid.UUID) (string, error) {
	var role string
	err := r.queryRowContext(ctx, `SELECT role FROM users WHERE id = $1`, id).Scan(&role)
	return role, translateNotFound("users", err)
}

// TOTPEnabled reports whether the user confirmed two-factor sign-in, from the
// table Authula's totp plugin keeps in its schema.
func (r *UserRepository) TOTPEnabled(ctx context.Context, id uuid.UUID) (bool, error) {
	var enabled bool
	err := r.queryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM authula.totp WHERE user_id = $1 AND enabled)`, id).Scan(&enabled)
	return enabled, err
}

// Plan returns a user's billing plan: free or subscribed.
func (r *UserRepository) Plan(ctx context.Context, id uuid.UUID) (string, error) {
	var plan string
	err := r.queryRowContext(ctx, `SELECT plan FROM users WHERE id = $1`, id).Scan(&plan)
	return plan, translateNotFound("users", err)
}
