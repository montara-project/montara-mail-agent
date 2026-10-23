package repositories

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// MailRepository manages mail synced from IMAP.
type MailRepository struct {
	BaseRepository
}

const mailColumns = `
	id, created_at, updated_at, email_account_id, folder, uid_validity, uid, message_id,
	from_name, from_email, "to", cc, subject, body, body_html, received_at, is_read, is_starred,
	importance, importance_by, summary`

// mailListColumns swaps the body for a 200-character, one-line teaser and
// leaves the HTML and the summary out.
const mailListColumns = `
	id, created_at, updated_at, email_account_id, folder, uid_validity, uid, message_id,
	from_name, from_email, "to", cc, subject, left(regexp_replace(body, '\s+', ' ', 'g'), 200), NULL, received_at, is_read, is_starred,
	importance, importance_by, NULL`

func scanMail(row rowScanner) (models.Mail, error) {
	var m models.Mail
	var to, cc []byte
	err := row.Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt, &m.EmailAccountID, &m.Folder, &m.UIDValidity, &m.UID, &m.MessageID,
		&m.FromName, &m.FromEmail, &to, &cc, &m.Subject, &m.Body, &m.BodyHTML, &m.ReceivedAt, &m.IsRead, &m.IsStarred,
		&m.Importance, &m.ImportanceBy, &m.Summary)
	if err != nil {
		return m, translateNotFound("mails", err)
	}
	if err := json.Unmarshal(to, &m.To); err != nil {
		return m, err
	}
	return m, json.Unmarshal(cc, &m.Cc)
}

// scanMailTeaser scans a mailListColumns row.
func scanMailTeaser(row rowScanner) (models.Mail, error) {
	m, err := scanMail(row)
	m.Teaser, m.Body = m.Body, ""
	return m, err
}

// DropStale removes a folder's mail synced under another UIDVALIDITY: the
// server renumbered the folder, so those uids no longer point at the same
// messages.
func (r *MailRepository) DropStale(ctx context.Context, accountID uuid.UUID, folder string, uidValidity uint32) error {
	_, err := r.execContext(ctx, `
		DELETE FROM mails WHERE email_account_id = $1 AND folder = $2 AND uid_validity <> $3`,
		accountID, folder, uidValidity,
	)
	return err
}

// MaxUID returns the highest uid synced from a folder, 0 when none is.
func (r *MailRepository) MaxUID(ctx context.Context, accountID uuid.UUID, folder string) (uint32, error) {
	var uid uint32
	err := r.queryRowContext(ctx, `
		SELECT COALESCE(max(uid), 0) FROM mails WHERE email_account_id = $1 AND folder = $2`,
		accountID, folder,
	).Scan(&uid)
	return uid, err
}

// InsertMany stores newly synced mail, skipping messages already stored, so
// two overlapping syncs of one account are harmless.
func (r *MailRepository) InsertMany(ctx context.Context, mails []models.Mail) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, m := range mails {
		to, err := json.Marshal(m.To)
		if err != nil {
			return err
		}
		cc, err := json.Marshal(m.Cc)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO mails (id, email_account_id, folder, uid_validity, uid, message_id, from_name, from_email,
				"to", cc, subject, body, body_html, received_at, is_read, is_starred)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
			ON CONFLICT (email_account_id, folder, uid) DO NOTHING`,
			m.ID, m.EmailAccountID, m.Folder, m.UIDValidity, m.UID, m.MessageID, m.FromName, m.FromEmail,
			to, cc, m.Subject, m.Body, m.BodyHTML, m.ReceivedAt, m.IsRead, m.IsStarred,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// MissingHTML returns up to limit uids of a folder's mail synced before the
// HTML part was kept, newest first.
func (r *MailRepository) MissingHTML(ctx context.Context, accountID uuid.UUID, folder string, limit int) ([]int64, error) {
	rows, err := r.queryContext(ctx, `
		SELECT uid FROM mails
		WHERE email_account_id = $1 AND folder = $2 AND body_html IS NULL
		ORDER BY uid DESC
		LIMIT $3`,
		accountID, folder, limit,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, func(row rowScanner) (int64, error) {
		var uid int64
		return uid, row.Scan(&uid)
	})
}

// SetBodies replaces the bodies of one synced mail.
func (r *MailRepository) SetBodies(ctx context.Context, accountID uuid.UUID, folder string, uid uint32, body, bodyHTML string) error {
	_, err := r.execContext(ctx, `
		UPDATE mails SET body = $4, body_html = $5, updated_at = now()
		WHERE email_account_id = $1 AND folder = $2 AND uid = $3`,
		accountID, folder, uid, body, bodyHTML,
	)
	return err
}

// MarkNoHTML records "no HTML part" on the given uids still missing one, so
// messages the server no longer returns are not asked for again.
func (r *MailRepository) MarkNoHTML(ctx context.Context, accountID uuid.UUID, folder string, uids []int64) error {
	_, err := r.execContext(ctx, `
		UPDATE mails SET body_html = ''
		WHERE email_account_id = $1 AND folder = $2 AND uid = ANY($3) AND body_html IS NULL`,
		accountID, folder, uids,
	)
	return err
}

// MailListParams are the list controls plus the folder and importance filters.
type MailListParams struct {
	ListParams
	Folder     string
	Importance string
}

func mailFilters(accountID uuid.UUID, p MailListParams) *whereBuilder {
	w := newWhere("TRUE")
	w.add(`email_account_id = $%d`, accountID)
	w.add(`folder = $%d`, p.Folder)
	if p.Importance != "" {
		w.add(`importance = $%d`, p.Importance)
	}
	w.search(p.Search, "from_name", "from_email", "subject")
	return w
}

// List returns one page of a folder's mail, newest first, with teasers
// instead of bodies.
func (r *MailRepository) List(ctx context.Context, accountID uuid.UUID, p MailListParams) ([]models.Mail, error) {
	where, args, limit, offset := mailFilters(accountID, p).page(p.ListParams)
	query := fmt.Sprintf(`
		SELECT %s FROM mails
		WHERE %s
		ORDER BY received_at DESC, id DESC
		LIMIT $%d OFFSET $%d`,
		mailListColumns, where, limit, offset)

	rows, err := r.queryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanMailTeaser)
}

// Count returns how many mails match the List filters.
func (r *MailRepository) Count(ctx context.Context, accountID uuid.UUID, p MailListParams) (int64, error) {
	return r.countRows(ctx, "mails", mailFilters(accountID, p))
}

// Unread returns how many mails of a folder are unread.
func (r *MailRepository) Unread(ctx context.Context, accountID uuid.UUID, folder string) (int64, error) {
	var n int64
	err := r.queryRowContext(ctx, `
		SELECT count(*) FROM mails WHERE email_account_id = $1 AND folder = $2 AND NOT is_read`,
		accountID, folder,
	).Scan(&n)
	return n, err
}

// Get returns one mail with its body.
func (r *MailRepository) Get(ctx context.Context, id uuid.UUID) (models.Mail, error) {
	return scanMail(r.queryRowContext(ctx, fmt.Sprintf(`SELECT %s FROM mails WHERE id = $1`, mailColumns), id))
}

// OrganizationOf returns the organization a mail belongs to, through its account.
func (r *MailRepository) OrganizationOf(ctx context.Context, id uuid.UUID) (uuid.UUID, error) {
	var organizationID uuid.UUID
	err := r.queryRowContext(ctx, `
		SELECT a.organization_id FROM mails m
		JOIN email_accounts a ON a.id = m.email_account_id
		WHERE m.id = $1`,
		id,
	).Scan(&organizationID)
	return organizationID, translateNotFound("mails", err)
}

// MailPatch holds the fields a user may change; nil leaves one as it is.
type MailPatch struct {
	IsRead     *bool
	IsStarred  *bool
	Importance *string
}

// Patch applies a user's changes. Setting the importance marks it as the
// user's, so the AI never overwrites it.
func (r *MailRepository) Patch(ctx context.Context, id uuid.UUID, p MailPatch) error {
	res, err := r.execContext(ctx, `
		UPDATE mails
		SET is_read = COALESCE($2, is_read),
			is_starred = COALESCE($3, is_starred),
			importance = COALESCE($4, importance),
			importance_by = CASE WHEN $4::varchar IS NULL THEN importance_by ELSE $5 END,
			updated_at = now()
		WHERE id = $1`,
		id, p.IsRead, p.IsStarred, p.Importance, constant.ImportanceByUser,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "mail")
}

// SetSummary caches a mail's AI summary.
func (r *MailRepository) SetSummary(ctx context.Context, id uuid.UUID, summary string) error {
	_, err := r.execContext(ctx, `UPDATE mails SET summary = $2, updated_at = now() WHERE id = $1`, id, summary)
	return err
}

// Unclassified returns up to limit inbox mails of an account that have no
// importance yet, newest first.
func (r *MailRepository) Unclassified(ctx context.Context, accountID uuid.UUID, limit int) ([]models.Mail, error) {
	rows, err := r.queryContext(ctx, fmt.Sprintf(`
		SELECT %s FROM mails
		WHERE email_account_id = $1 AND folder = $2 AND importance IS NULL
		ORDER BY received_at DESC
		LIMIT $3`, mailColumns),
		accountID, constant.FolderInbox, limit,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanMail)
}

// SetAIImportance stores the AI's classification unless the user already
// chose one.
func (r *MailRepository) SetAIImportance(ctx context.Context, id uuid.UUID, importance string) error {
	_, err := r.execContext(ctx, `
		UPDATE mails SET importance = $2, importance_by = $3, updated_at = now()
		WHERE id = $1 AND importance_by IS DISTINCT FROM $4`,
		id, importance, constant.ImportanceByAI, constant.ImportanceByUser,
	)
	return err
}
