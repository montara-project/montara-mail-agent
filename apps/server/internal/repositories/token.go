package repositories

import (
	"context"
	"time"

	"montara-mail-agent/server/internal/models"

	"github.com/google/uuid"
)

// TokenUsageRepository records every LLM call's token accounting.
type TokenUsageRepository struct{ BaseRepository }

// Insert persists one usage row. Callers fire it asynchronously: a client
// disconnecting mid-call must not cancel the accounting.
func (r *TokenUsageRepository) Insert(ctx context.Context, u models.TokenUsage) error {
	_, err := r.execContext(ctx, `
		INSERT INTO token_usage (user_id, organization_id, email_account_id, provider, model, purpose, input_tokens, output_tokens)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		u.UserID, u.OrganizationID, u.EmailAccountID, u.Provider, u.Model, u.Purpose, u.InputTokens, u.OutputTokens)
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

// Balance returns userID's pay-as-you-go tokens; zero before any top-up.
func (r *TokenBalanceRepository) Balance(ctx context.Context, userID uuid.UUID) (int64, error) {
	var balance int64
	err := r.queryRowContext(ctx, `
		SELECT balance_tokens FROM token_balances WHERE user_id = $1`,
		userID,
	).Scan(&balance)
	if translateNotFound("token_balances", err) != nil {
		return 0, nil // no row yet means an empty balance
	}
	return balance, err
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

// MarkPaidIfPending flips a top-up from pending to paid exactly once: the
// second webhook replay finds status already paid and reports false, so the
// balance is credited only once.
func (r *TokenTopupRepository) MarkPaidIfPending(ctx context.Context, referenceID string) (models.TokenTopup, bool, error) {
	var t models.TokenTopup
	err := r.queryRowContext(ctx, `
		UPDATE token_topups SET status = $2, paid_at = now()
		WHERE reference_id = $1 AND status = $3
		RETURNING `+tokenTopupColumns,
		referenceID, models.TopupStatusPaid, models.TopupStatusPending,
	).Scan(&t.ID, &t.CreatedAt, &t.UserID, &t.AmountIDR, &t.Tokens, &t.Status, &t.ReferenceID, &t.PayURL, &t.PaidAt)
	if translateNotFound("token_topups", err) != nil {
		return models.TokenTopup{}, false, nil
	}
	return t, true, err
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
