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
		INSERT INTO token_usage (user_id, organization_id, provider, model, purpose, input_tokens, output_tokens)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		u.UserID, u.OrganizationID, u.Provider, u.Model, u.Purpose, u.InputTokens, u.OutputTokens)
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
// zero. weeklyLimit is the user's plan allowance; with none (0 or less) no
// overflow can exist, so the stored balance stands. Only sql.ErrNoRows means
// an empty balance; anything else is a real failure.
func (r *TokenBalanceRepository) Balance(ctx context.Context, userID uuid.UUID, weeklyLimit int64) (int64, error) {
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
	if weeklyLimit <= 0 {
		return stored, nil
	}
	var overflow int64
	err = r.queryRowContext(ctx, `
		SELECT COALESCE(SUM(GREATEST(w.used - $2, 0)), 0) FROM (
			SELECT SUM(input_tokens + output_tokens) AS used
			FROM token_usage
			WHERE user_id = $1
			GROUP BY date_trunc('week', created_at AT TIME ZONE 'UTC')
		) w`,
		userID, weeklyLimit,
	).Scan(&overflow)
	if err != nil {
		return 0, err
	}
	return max64(stored - overflow), nil
}

// max64 clamps v at zero.
func max64(v int64) int64 {
	if v < 0 {
		return 0
	}
	return v
}

// AddTokens credits userID's pay-as-you-go balance by delta (top-ups only).
func (r *TokenBalanceRepository) AddTokens(ctx context.Context, userID uuid.UUID, delta int64) error {
	_, err := r.execContext(ctx, `
		INSERT INTO token_balances (user_id, balance_tokens) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE
		SET balance_tokens = token_balances.balance_tokens + $2, updated_at = now()`,
		userID, delta)
	return err
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

// ListByUser returns userID's top-ups, newest first.
func (r *TokenTopupRepository) ListByUser(ctx context.Context, userID uuid.UUID, limit int) ([]models.TokenTopup, error) {
	rows, err := r.queryContext(ctx, `
		SELECT `+tokenTopupColumns+` FROM token_topups WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
		userID, limit)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanTokenTopup)
}

// FoldOldOverflow moves the overflow each fully-elapsed week carried past the
// user's allowance into the stored balance, so deleting those usage rows
// leaves the effective pay-as-you-go balance unchanged. The retention sweep
// calls it before deleting old rows.
func (r *TokenBalanceRepository) FoldOldOverflow(ctx context.Context, cutoff time.Time, freeLimit, subscribedLimit int64) error {
	return lib.WithTransaction(ctx, r.DB, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `
			UPDATE token_balances b SET balance_tokens = GREATEST(b.balance_tokens - x.over, 0), updated_at = now()
			FROM (
				SELECT w.user_id, SUM(GREATEST(w.used - l.lim, 0)) AS over
				FROM (
					SELECT user_id, date_trunc('week', created_at AT TIME ZONE 'UTC') AS wk,
						SUM(input_tokens + output_tokens) AS used
					FROM token_usage
					WHERE date_trunc('week', created_at AT TIME ZONE 'UTC') < date_trunc('week', $1::timestamptz AT TIME ZONE 'UTC')
					GROUP BY 1, 2
				) w
				JOIN users u ON u.id = w.user_id
				CROSS JOIN LATERAL (
					SELECT CASE WHEN u.plan = 'subscribed' THEN $3::bigint ELSE $2::bigint END AS lim
				) l
				GROUP BY w.user_id
			) x
			WHERE b.user_id = x.user_id`,
			cutoff, freeLimit, subscribedLimit,
		)
		return err
	})
}

// DeleteUsageOlderThan removes usage rows from fully-elapsed weeks before the
// cutoff; the retention sweep folds their overflow first (see FoldOldOverflow).
func (r *TokenUsageRepository) DeleteUsageOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	res, err := r.execContext(ctx, `
		DELETE FROM token_usage
		WHERE date_trunc('week', created_at AT TIME ZONE 'UTC') < date_trunc('week', $1::timestamptz AT TIME ZONE 'UTC')`,
		cutoff,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
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
