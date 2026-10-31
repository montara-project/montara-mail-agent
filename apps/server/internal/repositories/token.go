package repositories

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"montara-mail-agent/server/internal/lib"
	"montara-mail-agent/server/internal/models"

	"github.com/google/uuid"
)

// TokenUsageRepository records every LLM call's token accounting.
type TokenUsageRepository struct{ BaseRepository }

// Insert persists one usage row. Callers fire it asynchronously: a client
// disconnecting mid-call must not cancel the accounting.
func (r *TokenUsageRepository) Insert(ctx context.Context, u models.TokenUsage) error {
	_, err := r.execContext(ctx, `
		INSERT INTO token_usage (user_id, organization_id, provider, model, purpose, input_tokens, output_tokens, weekly_limit)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		u.UserID, u.OrganizationID, u.Provider, u.Model, u.Purpose, u.InputTokens, u.OutputTokens, u.WeeklyLimit)
	return err
}

// SumSince totals input + output tokens user spent since since.
func (r *TokenUsageRepository) SumSince(ctx context.Context, userID uuid.UUID, since time.Time) (int64, error) {
	var sum int64
	err := r.queryRowContext(ctx, `
		SELECT COALESCE(SUM(input_tokens + output_tokens), 0)
		FROM token_usage WHERE user_id = $1 AND created_at >= $2`,
		userID, since,
	).Scan(&sum)
	return sum, err
}

// TokenBalanceRepository keeps the pay-as-you-go token balance per user.
type TokenBalanceRepository struct{ BaseRepository }

// Balance returns userID's remaining pay-as-you-go tokens: everything the
// top-ups bought, less what already covered weekly overflows, clamped at
// zero. A week is measured against the allowance its usage rows recorded, so
// a plan change doesn't rewrite past weeks; weeklyLimit, the tier's plans row
// allowance, covers rows without one. nil (or <= 0) means no overflow can
// exist, so the stored balance stands. Only sql.ErrNoRows means an empty
// balance; anything else is a real failure.
//
// ponytail: unlimited-tier and pre-0019 rows carry no allowance and read as the
// current tier's, and a week with a plan change counts its highest allowance.
func (r *TokenBalanceRepository) Balance(ctx context.Context, userID uuid.UUID, weeklyLimit *int64) (int64, error) {
	var stored int64
	err := r.queryRowContext(ctx, `
		SELECT balance_tokens FROM token_balances WHERE user_id = $1`,
		userID,
	).Scan(&stored)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	if weeklyLimit == nil || *weeklyLimit <= 0 {
		return stored, nil
	}
	var overflow int64
	err = r.queryRowContext(ctx, `
		SELECT COALESCE(SUM(GREATEST(w.used - COALESCE(w.lim, $2), 0)), 0) FROM (
			SELECT SUM(input_tokens + output_tokens) AS used, MAX(weekly_limit) AS lim
			FROM token_usage
			WHERE user_id = $1
			GROUP BY date_trunc('week', created_at AT TIME ZONE 'UTC')
		) w`,
		userID, weeklyLimit,
	).Scan(&overflow)
	if err != nil {
		return 0, err
	}
	return max(stored-overflow, 0), nil
}

// TokenTopupRepository tracks the pay-as-you-go purchases.
type TokenTopupRepository struct{ BaseRepository }

const tokenTopupColumns = `
	id, created_at, user_id, amount_idr, tokens, status, reference_id, pay_url, paid_at`

func scanTokenTopup(row rowScanner) (models.TokenTopup, error) {
	var t models.TokenTopup
	err := row.Scan(&t.ID, &t.CreatedAt, &t.UserID, &t.AmountIDR, &t.Tokens, &t.Status, &t.ReferenceID, &t.PayURL, &t.PaidAt)
	return t, translateNotFound("token_topups", err)
}

// Create inserts a pending top-up.
func (r *TokenTopupRepository) Create(ctx context.Context, t models.TokenTopup) error {
	_, err := r.execContext(ctx, `
		INSERT INTO token_topups (id, user_id, amount_idr, tokens, status, reference_id)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		t.ID, t.UserID, t.AmountIDR, t.Tokens, models.TopupStatusPending, t.ReferenceID)
	return err
}

// SetPayment stores the BorderPay checkout URL of a pending top-up.
func (r *TokenTopupRepository) SetPayment(ctx context.Context, id uuid.UUID, payURL string) error {
	_, err := r.execContext(ctx, `
		UPDATE token_topups SET pay_url = $2 WHERE id = $1`,
		id, payURL)
	return err
}

// MarkPaidAndCredit flips a pending top-up to paid and credits its balance in
// one transaction: the credit failing rolls the status back, so BorderPay's
// retry processes the payment again. A replay finds the status already paid
// and reports false, so the balance is credited only once. Only sql.ErrNoRows
// means "no pending top-up"; anything else is a real failure.
func (r *TokenTopupRepository) MarkPaidAndCredit(ctx context.Context, referenceID string) (models.TokenTopup, bool, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return models.TokenTopup{}, false, err
	}
	defer tx.Rollback()

	var t models.TokenTopup
	err = tx.QueryRowContext(ctx, `
		UPDATE token_topups SET status = $2, paid_at = now()
		WHERE reference_id = $1 AND status = $3
		RETURNING `+tokenTopupColumns,
		referenceID, models.TopupStatusPaid, models.TopupStatusPending,
	).Scan(&t.ID, &t.CreatedAt, &t.UserID, &t.AmountIDR, &t.Tokens, &t.Status, &t.ReferenceID, &t.PayURL, &t.PaidAt)
	if errors.Is(err, sql.ErrNoRows) {
		return models.TokenTopup{}, false, nil
	}
	if err != nil {
		return models.TokenTopup{}, false, err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO token_balances (user_id, balance_tokens) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE
		SET balance_tokens = token_balances.balance_tokens + $2, updated_at = now()`,
		t.UserID, t.Tokens,
	); err != nil {
		return models.TokenTopup{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return models.TokenTopup{}, false, err
	}
	return t, true, nil
}

// ByIDForUser returns one top-up by id, only when it belongs to userID.
func (r *TokenTopupRepository) ByIDForUser(ctx context.Context, id, userID uuid.UUID) (models.TokenTopup, error) {
	return scanTokenTopup(r.queryRowContext(ctx, `
		SELECT `+tokenTopupColumns+` FROM token_topups WHERE id = $1 AND user_id = $2`,
		id, userID,
	))
}

// ListByUser returns one page of userID's top-ups, newest first; the id keeps
// the order stable across pages when two share a timestamp.
func (r *TokenTopupRepository) ListByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]models.TokenTopup, error) {
	rows, err := r.queryContext(ctx, `
		SELECT `+tokenTopupColumns+` FROM token_topups WHERE user_id = $1
		ORDER BY created_at DESC, id DESC OFFSET $2 LIMIT $3`,
		userID, offset, limit)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanTokenTopup)
}

// CountByUser returns how many top-ups userID has.
func (r *TokenTopupRepository) CountByUser(ctx context.Context, userID uuid.UUID) (int, error) {
	var total int
	err := r.queryRowContext(ctx, `SELECT count(*) FROM token_topups WHERE user_id = $1`, userID).Scan(&total)
	return total, err
}

// FoldAndDeleteOldUsage moves the overflow each fully-elapsed week before the
// cutoff carried past the user's allowance into the stored balance, and deletes
// those usage rows, so the effective pay-as-you-go balance stays unchanged. It
// returns the rows deleted. One transaction holds both steps: a fold whose rows
// survived would be charged again by the next sweep. The lock makes a concurrent
// sweep wait, then find nothing left to fold. A week's limit is the one its rows
// recorded (see Balance), else the plans catalog's; a nil limit means the tier
// is unlimited and carries no overflow.
func (r *TokenBalanceRepository) FoldAndDeleteOldUsage(ctx context.Context, cutoff time.Time, free, pro, enterprise *int64) (int64, error) {
	var deleted int64
	err := lib.WithTransaction(ctx, r.DB, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext('montara-mail-agent:token-sweep'))`); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE token_balances b SET balance_tokens = GREATEST(b.balance_tokens - x.over, 0), updated_at = now()
			FROM (
				SELECT w.user_id, SUM(CASE WHEN l.lim IS NULL THEN 0
					ELSE GREATEST(w.used - l.lim, 0) END) AS over
				FROM (
					SELECT user_id, date_trunc('week', created_at AT TIME ZONE 'UTC') AS wk,
						SUM(input_tokens + output_tokens) AS used, MAX(weekly_limit) AS recorded
					FROM token_usage
					WHERE date_trunc('week', created_at AT TIME ZONE 'UTC') < date_trunc('week', $1::timestamptz AT TIME ZONE 'UTC')
					GROUP BY 1, 2
				) w
				JOIN users u ON u.id = w.user_id
				CROSS JOIN LATERAL (
					SELECT COALESCE(w.recorded, CASE u.plan
						WHEN 'pro' THEN $3::bigint
						WHEN 'enterprise' THEN $4::bigint
						ELSE $2::bigint END) AS lim
				) l
				GROUP BY w.user_id
			) x
			WHERE b.user_id = x.user_id`,
			cutoff, free, pro, enterprise,
		); err != nil {
			return err
		}
		res, err := tx.ExecContext(ctx, `
			DELETE FROM token_usage
			WHERE date_trunc('week', created_at AT TIME ZONE 'UTC') < date_trunc('week', $1::timestamptz AT TIME ZONE 'UTC')`,
			cutoff,
		)
		if err != nil {
			return err
		}
		deleted, err = res.RowsAffected()
		return err
	})
	return deleted, err
}

// ExpireStaleTopups marks pending top-ups older than a day as expired;
// BorderPay expires its QRIS in an hour, so these were never paid.
func (r *TokenTopupRepository) ExpireStaleTopups(ctx context.Context) (int64, error) {
	res, err := r.execContext(ctx, `
		UPDATE token_topups SET status = $1
		WHERE status = $2 AND created_at < now() - interval '24 hours'`,
		models.TopupStatusExpired, models.TopupStatusPending,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
