package repositories

import (
	"context"

	"montara-mail-agent/server/internal/lib/constant"
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

// Sessions lists the user's live Authula sign-ins, most recently renewed
// first. Authula writes its timestamps in UTC without a zone.
func (r *UserRepository) Sessions(ctx context.Context, id uuid.UUID) ([]models.Session, error) {
	rows, err := r.queryContext(ctx, `
		SELECT id, ip_address, user_agent, created_at, updated_at, expires_at
		FROM authula.sessions
		WHERE user_id = $1 AND expires_at > (now() AT TIME ZONE 'utc')
		ORDER BY updated_at DESC`, id)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, func(row rowScanner) (models.Session, error) {
		var s models.Session
		err := row.Scan(&s.ID, &s.IPAddress, &s.UserAgent, &s.CreatedAt, &s.UpdatedAt, &s.ExpiresAt)
		return s, err
	})
}

// DeleteSession ends one of the user's sessions; its refresh tokens cascade,
// and the access tokens it issued stop verifying. Another user's session
// reads as missing.
func (r *UserRepository) DeleteSession(ctx context.Context, id uuid.UUID, sessionID uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM authula.sessions WHERE id = $1 AND user_id = $2`, sessionID, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "session")
}

// DeleteOtherSessions ends every session of the user but keep, and returns
// how many it ended.
func (r *UserRepository) DeleteOtherSessions(ctx context.Context, id uuid.UUID, keep string) (int64, error) {
	res, err := r.execContext(ctx, `DELETE FROM authula.sessions WHERE user_id = $1 AND id::text <> $2`, id, keep)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
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

// SuperUsersOtherThan counts the super users besides id, so the last one
// cannot delete their own account and leave the platform unmanageable.
func (r *UserRepository) SuperUsersOtherThan(ctx context.Context, id uuid.UUID) (int, error) {
	var n int
	err := r.queryRowContext(ctx,
		`SELECT count(*) FROM users WHERE role = $2 AND id <> $1`,
		id, constant.RoleSuperUser,
	).Scan(&n)
	return n, err
}

// Purge deletes a user and everything only they own, in one transaction: the
// rows no foreign key cascades away (billing, quota, agent work, the activity
// log, API keys), their memberships, and the organizations they are the only
// member of, with their mailboxes, mail and agent data. An organization shared
// with someone else survives without this user. The Authula row goes last, so
// its accounts, sessions and two-factor state cascade with it.
func (r *UserRepository) Purge(ctx context.Context, id uuid.UUID) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Organizations nobody else belongs to: with the account gone there is no
	// owner left, so they go too.
	if _, err := tx.ExecContext(ctx, `
		CREATE TEMP TABLE purge_orgs ON COMMIT DROP AS
		SELECT organization_id
		FROM organization_members
		WHERE user_id = $1
		GROUP BY organization_id
		HAVING count(*) = 1`, id); err != nil {
		return err
	}

	// Mailboxes and the agent's outbound actions reference the organization
	// without a cascade, so they are cleared before their organizations.
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM email_accounts
		WHERE organization_id IN (SELECT organization_id FROM purge_orgs)`); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM agent_actions
		WHERE user_id = $1 OR organization_id IN (SELECT organization_id FROM purge_orgs)`, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM organizations
		WHERE id IN (SELECT organization_id FROM purge_orgs)`); err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM organization_members WHERE user_id = $1`, id); err != nil {
		return err
	}
	// Conversations this user had, in organizations that outlive them.
	if _, err := tx.ExecContext(ctx, `DELETE FROM agent_conversations WHERE user_id = $1`, id); err != nil {
		return err
	}
	// A draft they reviewed stays with the organization that owns it.
	if _, err := tx.ExecContext(ctx, `UPDATE agent_drafts SET decided_by = NULL WHERE decided_by = $1`, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM activity_logs WHERE user_id = $1`, id); err != nil {
		return err
	}
	// API keys carry an owner id, not a foreign key; the plugin keeps them in
	// Authula's schema.
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM authula.api_keys WHERE owner_type = 'user' AND owner_id = $1`, id); err != nil {
		return err
	}

	// Billing and quota history name the user without a cascade.
	for _, table := range []string{
		"wallet_transactions", "wallet_topups", "wallet_balances", "subscriptions",
		"token_topups", "token_balances", "token_usage",
	} {
		if _, err := tx.ExecContext(ctx, `DELETE FROM `+table+` WHERE user_id = $1`, id); err != nil {
			return err
		}
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, id); err != nil {
		return err
	}
	// The Authula row last, in the same transaction: its accounts, sessions,
	// API keys and two-factor state cascade from it.
	if _, err := tx.ExecContext(ctx, `DELETE FROM authula.users WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit()
}
