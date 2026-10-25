package repositories

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// ActivityLogRepository manages the activity log: recorded actions users
// took, read back per user or per organization.
type ActivityLogRepository struct {
	BaseRepository
}

const activityLogColumns = `
	a.id, a.created_at, a.user_id, a.organization_id, a.action, a.description,
	a.metadata, a.ip, a.user_agent, COALESCE(u.name, ''), COALESCE(u.email, '')`

// ActivityLogScope selects whose entries a list returns: the ones of a user
// or the ones of an organization, whichever is set.
type ActivityLogScope struct {
	UserID         uuid.UUID
	OrganizationID uuid.UUID
}

func (s ActivityLogScope) filters(w *whereBuilder) {
	if s.UserID != uuid.Nil {
		w.add(`a.user_id = $%d`, s.UserID)
	}
	if s.OrganizationID != uuid.Nil {
		w.add(`a.organization_id = $%d`, s.OrganizationID)
	}
}

var activityLogSortColumns = map[string]string{"created_at": "a.created_at"}

func scanActivityLog(row rowScanner) (models.ActivityLog, error) {
	var a models.ActivityLog
	var metadata []byte
	err := row.Scan(&a.ID, &a.CreatedAt, &a.UserID, &a.OrganizationID, &a.Action, &a.Description,
		&metadata, &a.IP, &a.UserAgent, &a.ActorName, &a.ActorEmail)
	if err != nil {
		return a, translateNotFound("activity_logs", err)
	}
	if len(metadata) > 0 {
		a.Metadata = metadata
	}
	return a, nil
}

// Insert stores one entry. The id and timestamp come from the table defaults.
func (r *ActivityLogRepository) Insert(ctx context.Context, a models.ActivityLog) error {
	_, err := r.execContext(ctx, `
		INSERT INTO activity_logs (user_id, organization_id, action, description, metadata, ip, user_agent)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		a.UserID, a.OrganizationID, a.Action, a.Description, []byte(a.Metadata), a.IP, a.UserAgent,
	)
	return err
}

// Record stores one entry, best effort: the log must never break the action
// it witnesses, so a failed write is only logged.
func (r *ActivityLogRepository) Record(ctx context.Context, a models.ActivityLog) {
	if err := r.Insert(ctx, a); err != nil {
		slog.Warn("activity log write failed", "action", a.Action, "error", err)
	}
}

// DeleteOlderThan removes every entry created before cutoff, returning how
// many went; the retention sweep calls it (see ACTIVITY_LOG_RETENTION).
func (r *ActivityLogRepository) DeleteOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	res, err := r.execContext(ctx, `DELETE FROM activity_logs WHERE created_at < $1`, cutoff)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// List returns one page of entries, newest first, optionally filtered by a
// case-insensitive description search. Callers clamp the offset/limit first
// (see dtos.ListQuery.Clamp).
func (r *ActivityLogRepository) List(ctx context.Context, p ListParams, scope ActivityLogScope) ([]models.ActivityLog, error) {
	w := newWhere("TRUE")
	scope.filters(w)
	w.search(p.Search, "a.description", "a.action")
	where, args, limit, offset := w.page(p)

	query := fmt.Sprintf(`
		SELECT %s FROM activity_logs a
		LEFT JOIN users u ON u.id = a.user_id
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d`,
		activityLogColumns, where,
		resolveOrder(p.Sorted, activityLogSortColumns, "a.created_at DESC"), limit, offset)

	rows, err := r.queryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanActivityLog)
}

// Count returns how many entries match the List filters, for the response
// meta block.
func (r *ActivityLogRepository) Count(ctx context.Context, p ListParams, scope ActivityLogScope) (int64, error) {
	w := newWhere("TRUE")
	scope.filters(w)
	w.search(p.Search, "a.description", "a.action")
	return r.countRows(ctx, "activity_logs a", w)
}
