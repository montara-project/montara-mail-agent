package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// EmailAccountRepository manages the IMAP mailboxes connected to organizations.
type EmailAccountRepository struct {
	BaseRepository
}

const emailAccountColumns = `
	a.id, a.created_at, a.updated_at, a.organization_id, a.provider, a.label, a.email,
	a.imap_host, a.imap_port, a.username, a.password, a.oauth_access_token, a.oauth_refresh_token,
	a.oauth_token_expiry, a.synced_at, a.sync_error, a.smtp_host, a.smtp_port`

func scanEmailAccount(row rowScanner) (models.EmailAccount, error) {
	var a models.EmailAccount
	err := row.Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt, &a.OrganizationID, &a.Provider, &a.Label, &a.Email,
		&a.IMAPHost, &a.IMAPPort, &a.Username, &a.Password, &a.OAuthAccessToken, &a.OAuthRefreshToken,
		&a.OAuthTokenExpiry, &a.SyncedAt, &a.SyncError, &a.SMTPHost, &a.SMTPPort)
	return a, translateNotFound("email_accounts", err)
}

// Insert persists a new account; the same address twice in one
// organization is a conflict. An OAuth-connected account carries tokens
// instead of a password.
func (r *EmailAccountRepository) Insert(ctx context.Context, a models.EmailAccount) error {
	_, err := r.execContext(ctx, `
		INSERT INTO email_accounts (id, organization_id, provider, label, email, imap_host, imap_port, username, password, smtp_host, smtp_port, oauth_access_token, oauth_refresh_token, oauth_token_expiry)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		a.ID, a.OrganizationID, a.Provider, a.Label, a.Email, a.IMAPHost, a.IMAPPort, a.Username, a.Password, a.SMTPHost, a.SMTPPort,
		a.OAuthAccessToken, a.OAuthRefreshToken, a.OAuthTokenExpiry,
	)
	return translateUnique(err, "this email account is already connected")
}

// Get returns one account by id.
func (r *EmailAccountRepository) Get(ctx context.Context, id uuid.UUID) (models.EmailAccount, error) {
	query := fmt.Sprintf(`SELECT %s FROM email_accounts a WHERE a.id = $1`, emailAccountColumns)
	return scanEmailAccount(r.queryRowContext(ctx, query, id))
}

// UpdateOrganization moves an account to another organization in one
// transaction: the row itself, and the agent conversations and drafts that
// reference it (they carry their own organization_id). Mails need nothing —
// they hang off the account row and carry no organization of their own.
func (r *EmailAccountRepository) UpdateOrganization(ctx context.Context, id, organizationID uuid.UUID) (models.EmailAccount, error) {
	var moved models.EmailAccount
	err := lib.WithTransaction(ctx, r.DB, func(tx *sql.Tx) error {
		err := tx.QueryRowContext(ctx, `
			UPDATE email_accounts a SET organization_id = $2, updated_at = now()
			WHERE a.id = $1
			RETURNING `+emailAccountColumns,
			id, organizationID,
		).Scan(&moved.ID, &moved.CreatedAt, &moved.UpdatedAt, &moved.OrganizationID, &moved.Provider, &moved.Label, &moved.Email,
			&moved.IMAPHost, &moved.IMAPPort, &moved.Username, &moved.Password, &moved.OAuthAccessToken, &moved.OAuthRefreshToken,
			&moved.OAuthTokenExpiry, &moved.SyncedAt, &moved.SyncError, &moved.SMTPHost, &moved.SMTPPort)
		if err != nil {
			return translateUnique(err, "this email account is already connected in that organization")
		}
		if _, err := tx.ExecContext(ctx,
			`UPDATE agent_conversations SET organization_id = $2 WHERE email_account_id = $1`, id, organizationID,
		); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx,
			`UPDATE agent_drafts SET organization_id = $2 WHERE email_account_id = $1`, id, organizationID,
		)
		return err
	})
	return moved, err
}

// ListByOrganization returns an organization's accounts, oldest first, each
// with its unread inbox and spam counts.
func (r *EmailAccountRepository) ListByOrganization(ctx context.Context, organizationID uuid.UUID) ([]models.EmailAccount, error) {
	query := fmt.Sprintf(`
		SELECT %s,
			(SELECT count(*) FROM mails m WHERE m.email_account_id = a.id AND m.folder = $2 AND NOT m.is_read),
			(SELECT count(*) FROM mails m WHERE m.email_account_id = a.id AND m.folder = $3)
		FROM email_accounts a
		WHERE a.organization_id = $1
		ORDER BY a.created_at`, emailAccountColumns)

	rows, err := r.queryContext(ctx, query, organizationID, constant.FolderInbox, constant.FolderSpam)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, func(row rowScanner) (models.EmailAccount, error) {
		var a models.EmailAccount
		err := row.Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt, &a.OrganizationID, &a.Provider, &a.Label, &a.Email,
			&a.IMAPHost, &a.IMAPPort, &a.Username, &a.Password, &a.OAuthAccessToken, &a.OAuthRefreshToken,
			&a.OAuthTokenExpiry, &a.SyncedAt, &a.SyncError, &a.SMTPHost, &a.SMTPPort, &a.Unread, &a.Spam)
		return a, err
	})
}

// All returns every account, for the background sync.
func (r *EmailAccountRepository) All(ctx context.Context) ([]models.EmailAccount, error) {
	rows, err := r.queryContext(ctx, fmt.Sprintf(`SELECT %s FROM email_accounts a ORDER BY a.synced_at NULLS FIRST`, emailAccountColumns))
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanEmailAccount)
}

// SetSynced records a sync run: success stamps synced_at and clears the
// error, a failure keeps the last good synced_at and stores the error.
func (r *EmailAccountRepository) SetSynced(ctx context.Context, id uuid.UUID, syncErr *string) error {
	_, err := r.execContext(ctx, `
		UPDATE email_accounts
		SET synced_at = CASE WHEN $2::text IS NULL THEN now() ELSE synced_at END,
			sync_error = $2, updated_at = now()
		WHERE id = $1`,
		id, syncErr,
	)
	return err
}

// SetOAuthTokens stores a refreshed token pair, sealed by the caller; it
// also clears the sync error so a token hiccup doesn't outlive its fix.
func (r *EmailAccountRepository) SetOAuthTokens(ctx context.Context, id uuid.UUID, access, refresh []byte, expiry time.Time) error {
	_, err := r.execContext(ctx, `
		UPDATE email_accounts
		SET oauth_access_token = $2, oauth_refresh_token = $3, oauth_token_expiry = $4,
			sync_error = NULL, updated_at = now()
		WHERE id = $1`,
		id, access, refresh, expiry,
	)
	return err
}

// Delete removes an account and, by cascade, its synced mail.
func (r *EmailAccountRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM email_accounts WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "email account")
}

// OrganizationStats are the dashboard totals of one organization.
type OrganizationStats struct {
	Unread   int `json:"unread"`
	Spam     int `json:"spam"`
	Accounts int `json:"accounts"`
}

// Stats returns the unread inbox mail, spam and account counts of an organization.
func (r *EmailAccountRepository) Stats(ctx context.Context, organizationID uuid.UUID) (OrganizationStats, error) {
	var s OrganizationStats
	err := r.queryRowContext(ctx, `
		SELECT
			(SELECT count(*) FROM mails m JOIN email_accounts a ON a.id = m.email_account_id
				WHERE a.organization_id = $1 AND m.folder = $2 AND NOT m.is_read),
			(SELECT count(*) FROM mails m JOIN email_accounts a ON a.id = m.email_account_id
				WHERE a.organization_id = $1 AND m.folder = $3),
			(SELECT count(*) FROM email_accounts WHERE organization_id = $1)`,
		organizationID, constant.FolderInbox, constant.FolderSpam,
	).Scan(&s.Unread, &s.Spam, &s.Accounts)
	return s, err
}

// CountByUser counts the mailboxes connected across every organization the
// user belongs to: the free plan caps this per user, not per organization.
func (r *EmailAccountRepository) CountByUser(ctx context.Context, userID uuid.UUID) (int, error) {
	var n int
	err := r.queryRowContext(ctx, `
		SELECT count(DISTINCT ea.id) FROM email_accounts ea
		JOIN organization_members m ON m.organization_id = ea.organization_id
		WHERE m.user_id = $1`,
		userID,
	).Scan(&n)
	return n, err
}
