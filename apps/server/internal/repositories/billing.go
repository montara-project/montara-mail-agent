package repositories

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"montara-mail-agent/server/internal/lib/apperr"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"

	"github.com/google/uuid"
)

// PlanRepository reads the pricing catalog. Plans are enforcement data as
// well as pricing data: the weekly token allowance, the mailbox and
// organization caps a user's tier carries.
type PlanRepository struct{ BaseRepository }

const planColumns = `
	id, created_at, updated_at, code, name, description, billing_interval, amount,
	currency, COALESCE(discount_amount, 0), discount_ends_at, max_email_accounts,
	max_organizations, weekly_tokens, active, sort_order`

func scanPlan(row rowScanner) (models.Plan, error) {
	var p models.Plan
	err := row.Scan(
		&p.ID, &p.CreatedAt, &p.UpdatedAt, &p.Code, &p.Name, &p.Description,
		&p.BillingInterval, &p.Amount, &p.Currency, &p.DiscountAmount, &p.DiscountEndsAt,
		&p.MaxEmailAccounts, &p.MaxOrganizations, &p.WeeklyTokens, &p.Active, &p.SortOrder,
	)
	return p, translateNotFound("plans", err)
}

// List returns every active plan in display order.
func (r *PlanRepository) List(ctx context.Context) ([]models.Plan, error) {
	rows, err := r.queryContext(ctx, `SELECT `+planColumns+` FROM plans WHERE active ORDER BY sort_order, amount`)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanPlan)
}

// All returns every plan row regardless of active, for the catalog cache.
func (r *PlanRepository) All(ctx context.Context) ([]models.Plan, error) {
	rows, err := r.queryContext(ctx, `SELECT `+planColumns+` FROM plans ORDER BY sort_order, amount`)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanPlan)
}

// ByCode returns one plan whatever its state; checkout validates it.
func (r *PlanRepository) ByCode(ctx context.Context, code string) (models.Plan, error) {
	return scanPlan(r.queryRowContext(ctx, `SELECT `+planColumns+` FROM plans WHERE code = $1`, code))
}

// SubscriptionRepository keeps one paid period per user, joined to its plan
// for the user-facing view. One live (pending or active) subscription per
// user is enforced by a partial unique index; ended ones stay as history.
type SubscriptionRepository struct{ BaseRepository }

// subscriptionColumns selects the subscription row joined to its plan row;
// the plan's code, name and interval fill the view fields.
const subscriptionColumns = `
	s.id, s.created_at, s.updated_at, s.user_id, s.plan_id,
	p.code, p.name, p.billing_interval,
	s.status, s.current_period_start, s.current_period_end, s.amount, s.currency,
	s.reference_id, s.pay_url, s.auto_renew, s.canceled_at`

func scanSubscription(row rowScanner) (models.Subscription, error) {
	var s models.Subscription
	err := row.Scan(
		&s.ID, &s.CreatedAt, &s.UpdatedAt, &s.UserID, &s.PlanID,
		&s.PlanCode, &s.PlanName, &s.BillingInterval,
		&s.Status, &s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.Amount, &s.Currency,
		&s.ReferenceID, &s.PayURL, &s.AutoRenew, &s.CanceledAt,
	)
	return s, translateNotFound("subscriptions", err)
}

const subscriptionJoins = ` FROM subscriptions s JOIN plans p ON p.id = s.plan_id `

// Create inserts a pending subscription at checkout time; amount snapshots
// the plan's current effective price, what BorderPay will charge.
func (r *SubscriptionRepository) Create(ctx context.Context, s models.Subscription) error {
	_, err := r.execContext(ctx, `
		INSERT INTO subscriptions (id, user_id, plan_id, status, amount, currency, reference_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		s.ID, s.UserID, s.PlanID, models.SubscriptionStatusPending, s.Amount, s.Currency, s.ReferenceID)
	return err
}

// SetPayment stores the BorderPay checkout URL of a pending subscription.
func (r *SubscriptionRepository) SetPayment(ctx context.Context, id uuid.UUID, payURL string) error {
	_, err := r.execContext(ctx, `UPDATE subscriptions SET pay_url = $2 WHERE id = $1`, id, payURL)
	return err
}

// LiveByUser returns the user's pending or active subscription; not-found
// means the user has none (they are on the free plan unless set by hand).
func (r *SubscriptionRepository) LiveByUser(ctx context.Context, userID uuid.UUID) (models.Subscription, error) {
	return scanSubscription(r.queryRowContext(ctx, `SELECT `+subscriptionColumns+subscriptionJoins+
		` WHERE s.user_id = $1 AND s.status IN ('pending', 'active')`, userID))
}

// MarkPaidAndActivate flips a pending subscription to active and starts its
// period in one transaction, setting the user's plan to pro. The plan
// downgrade guard keeps an enterprise-flagged account (set by hand) from
// being switched by a stray pro checkout. A replay finds no pending row and
// reports false, so activation happens exactly once.
func (r *SubscriptionRepository) MarkPaidAndActivate(ctx context.Context, referenceID string) (models.Subscription, bool, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return models.Subscription{}, false, err
	}
	defer tx.Rollback()

	s, err := scanSubscription(tx.QueryRowContext(ctx, `
		UPDATE subscriptions s
		SET status = $2,
			current_period_start = now(),
			current_period_end = now() + CASE WHEN p.billing_interval = 'year'
				THEN interval '1 year' ELSE interval '1 month' END,
			updated_at = now()
		FROM plans p
		WHERE s.plan_id = p.id AND s.reference_id = $1 AND s.status = $3
		RETURNING `+subscriptionColumns,
		referenceID, models.SubscriptionStatusActive, models.SubscriptionStatusPending,
	))
	if apperr.IsNotFound(err) {
		return models.Subscription{}, false, nil
	}
	if err != nil {
		return models.Subscription{}, false, err
	}

	// The plan follows the paid period; an enterprise-flagged account stays.
	if _, err := tx.ExecContext(ctx,
		`UPDATE users SET plan = $2 WHERE id = $1 AND plan <> $3`,
		s.UserID, constant.PlanPro, constant.PlanEnterprise,
	); err != nil {
		return models.Subscription{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return models.Subscription{}, false, err
	}
	return s, true, nil
}

// dueRow is a subscription whose period has ended, with its plan's pricing.
type dueRow struct {
	sub  models.Subscription
	plan models.Plan
}

// DueForRenewal lists the active subscriptions whose period has ended, with
// the plan's pricing columns for the effective-price computation.
func (r *SubscriptionRepository) DueForRenewal(ctx context.Context) ([]dueRow, error) {
	rows, err := r.queryContext(ctx, `SELECT `+subscriptionColumns+
		`, p.amount, COALESCE(p.discount_amount, 0), p.discount_ends_at`+subscriptionJoins+
		` WHERE s.status = $1 AND s.current_period_end <= now()
		ORDER BY s.current_period_end`,
		models.SubscriptionStatusActive,
	)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, func(row rowScanner) (dueRow, error) {
		var d dueRow
		err := row.Scan(
			&d.sub.ID, &d.sub.CreatedAt, &d.sub.UpdatedAt, &d.sub.UserID, &d.sub.PlanID,
			&d.sub.PlanCode, &d.sub.PlanName, &d.sub.BillingInterval,
			&d.sub.Status, &d.sub.CurrentPeriodStart, &d.sub.CurrentPeriodEnd, &d.sub.Amount, &d.sub.Currency,
			&d.sub.ReferenceID, &d.sub.PayURL, &d.sub.AutoRenew, &d.sub.CanceledAt,
			&d.plan.Amount, &d.plan.DiscountAmount, &d.plan.DiscountEndsAt,
		)
		return d, err
	})
}

// RenewDue renews or expires every subscription whose period has ended. One
// transaction per subscription: it re-locks the row, so two replicas running
// the sweep renew a subscription exactly once, and the wallet deduction, the
// period extension and the ledger entry commit or roll back together. One
// failing subscription doesn't hold up the rest.
func (r *SubscriptionRepository) RenewDue(ctx context.Context) (renewed, expired int, err error) {
	due, err := r.DueForRenewal(ctx)
	if err != nil {
		return 0, 0, err
	}
	var failures []error
	for _, d := range due {
		outcome, err := r.renewOne(ctx, d)
		if err != nil {
			failures = append(failures, err)
			continue
		}
		switch outcome {
		case "renewed":
			renewed++
		case "expired":
			expired++
		}
	}
	return renewed, expired, errors.Join(failures...)
}

// renewOne carries one due subscription through the daily sweep: it re-locks
// the row (two replicas must not renew the same subscription twice), charges
// the wallet, and extends the period or expires the plan.
func (r *SubscriptionRepository) renewOne(ctx context.Context, d dueRow) (string, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	// Re-read under the row lock: a concurrent sweep waits here, then finds the
	// period already extended, or the row already expired. The switch is read
	// here too, since the user may have flipped it since the list was taken.
	var autoRenew bool
	err = tx.QueryRowContext(ctx, `
		SELECT auto_renew FROM subscriptions
		WHERE id = $1 AND status = $2 AND current_period_end <= now()
		FOR UPDATE`,
		d.sub.ID, models.SubscriptionStatusActive,
	).Scan(&autoRenew)
	if errors.Is(err, sql.ErrNoRows) {
		return "skipped", nil
	}
	if err != nil {
		return "", err
	}

	// Switched off, or the wallet cannot cover the next period: the period
	// simply ends, and the plan downgrades with it. Both paths commit below.
	if !autoRenew {
		if err := r.expireOne(ctx, tx, d.sub.ID, d.sub.UserID); err != nil {
			return "", err
		}
		if err := tx.Commit(); err != nil {
			return "", err
		}
		return "expired", nil
	}

	// Charge the wallet: the guarded UPDATE only moves when the balance
	// covers the effective price, so an empty wallet falls through to the
	// expiry path below.
	price := d.plan.EffectivePrice(time.Now())
	var charged bool
	err = tx.QueryRowContext(ctx, `
		UPDATE wallet_balances SET balance_idr = balance_idr - $2, updated_at = now()
		WHERE user_id = $1 AND balance_idr >= $2
		RETURNING true`,
		d.sub.UserID, price,
	).Scan(&charged)
	if errors.Is(err, sql.ErrNoRows) {
		if err := r.expireOne(ctx, tx, d.sub.ID, d.sub.UserID); err != nil {
			return "", err
		}
		if err := tx.Commit(); err != nil {
			return "", err
		}
		return "expired", nil
	}
	if err != nil {
		return "", err
	}

	// The charge landed: extend the period, snapshot the current price, and
	// write the ledger entry — same transaction as the deduction.
	interval := models.BillingMonth
	if d.sub.BillingInterval != nil && *d.sub.BillingInterval == models.BillingYear {
		interval = models.BillingYear
	}
	res, err := tx.ExecContext(ctx, `
		UPDATE subscriptions
		SET current_period_start = current_period_end,
			current_period_end = current_period_end + CASE WHEN $3 = 'year'
				THEN interval '1 year' ELSE interval '1 month' END,
			amount = $2, updated_at = now()
		WHERE id = $1 AND status = $4 AND current_period_end <= now()`,
		d.sub.ID, price, interval, models.SubscriptionStatusActive,
	)
	if err != nil {
		return "", err
	}
	// A charge with no period to show for it must not commit.
	if err := requireAffected(res, "subscriptions"); err != nil {
		return "", err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO wallet_transactions (user_id, kind, amount_idr, reference_type, reference_id, note)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		d.sub.UserID, models.WalletKindSubscriptionCharge, -price,
		"subscription", d.sub.ID, "Subscription renewal",
	); err != nil {
		return "", err
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	return "renewed", nil
}

// expireOne ends a due subscription inside the caller's transaction: the row
// flips to expired and the user's plan downgrades to free (an
// enterprise-flagged account is left alone).
func (r *SubscriptionRepository) expireOne(ctx context.Context, tx *sql.Tx, id, userID uuid.UUID) error {
	if _, err := tx.ExecContext(ctx, `
		UPDATE subscriptions SET status = $2, updated_at = now()
		WHERE id = $1 AND status = $3`,
		id, models.SubscriptionStatusExpired, models.SubscriptionStatusActive,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx,
		`UPDATE users SET plan = $2 WHERE id = $1 AND plan = $3`,
		userID, constant.PlanFree, constant.PlanPro,
	)
	return err
}

// SetAutoRenew flips the user's live subscription's renewal switch: off
// stamps canceled_at (the switch-off moment), on clears it.
func (r *SubscriptionRepository) SetAutoRenew(ctx context.Context, userID uuid.UUID, enabled bool) error {
	res, err := r.execContext(ctx, `
		UPDATE subscriptions
		SET auto_renew = $2, canceled_at = CASE WHEN $2 THEN NULL ELSE now() END, updated_at = now()
		WHERE user_id = $1 AND status = $3`,
		userID, enabled, models.SubscriptionStatusActive,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "subscriptions")
}

// ExpirePending ends the user's pending checkout once it is older than age, so
// a QRIS that can no longer be paid doesn't hold their one live subscription.
func (r *SubscriptionRepository) ExpirePending(ctx context.Context, userID uuid.UUID, age time.Duration) error {
	_, err := r.execContext(ctx, `
		UPDATE subscriptions SET status = $2, updated_at = now()
		WHERE user_id = $1 AND status = $3 AND created_at < now() - make_interval(secs => $4)`,
		userID, models.SubscriptionStatusExpired, models.SubscriptionStatusPending, age.Seconds(),
	)
	return err
}

// ExpireStalePending marks pending subscriptions older than a day expired;
// BorderPay expires its QRIS in an hour, so these were never paid. The plan
// was never activated, so nothing else moves.
func (r *SubscriptionRepository) ExpireStalePending(ctx context.Context) (int64, error) {
	res, err := r.execContext(ctx, `
		UPDATE subscriptions SET status = $1, updated_at = now()
		WHERE status = $2 AND created_at < now() - interval '24 hours'`,
		models.SubscriptionStatusExpired, models.SubscriptionStatusPending,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

// WalletRepository keeps the IDR wallet a subscription renews from: the
// balance, the audit ledger, and the top-ups that fill it.
type WalletRepository struct{ BaseRepository }

// Balance returns the user's wallet balance, 0 before the first top-up.
func (r *WalletRepository) Balance(ctx context.Context, userID uuid.UUID) (int64, error) {
	var b int64
	err := r.queryRowContext(ctx,
		`SELECT COALESCE((SELECT balance_idr FROM wallet_balances WHERE user_id = $1), 0)`, userID,
	).Scan(&b)
	return b, err
}

const walletTopupColumns = `
	id, created_at, user_id, amount_idr, status, reference_id, pay_url, paid_at`

func scanWalletTopup(row rowScanner) (models.WalletTopup, error) {
	var t models.WalletTopup
	err := row.Scan(&t.ID, &t.CreatedAt, &t.UserID, &t.AmountIDR, &t.Status,
		&t.ReferenceID, &t.PayURL, &t.PaidAt)
	return t, translateNotFound("wallet_topups", err)
}

// CreateTopup inserts a pending wallet top-up.
func (r *WalletRepository) CreateTopup(ctx context.Context, t models.WalletTopup) error {
	_, err := r.execContext(ctx, `
		INSERT INTO wallet_topups (id, user_id, amount_idr, status, reference_id)
		VALUES ($1, $2, $3, $4, $5)`,
		t.ID, t.UserID, t.AmountIDR, models.TopupStatusPending, t.ReferenceID)
	return err
}

// SetTopupPayment stores the BorderPay checkout URL of a pending top-up.
func (r *WalletRepository) SetTopupPayment(ctx context.Context, id uuid.UUID, payURL string) error {
	_, err := r.execContext(ctx, `UPDATE wallet_topups SET pay_url = $2 WHERE id = $1`, id, payURL)
	return err
}

// MarkTopupPaidAndCredit flips a pending wallet top-up to paid and credits
// the wallet and the ledger in one transaction, the token top-up flow's
// idempotency pattern: a replay finds the status already paid and reports
// false, so the money is credited exactly once.
func (r *WalletRepository) MarkTopupPaidAndCredit(ctx context.Context, referenceID string) (models.WalletTopup, bool, error) {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return models.WalletTopup{}, false, err
	}
	defer tx.Rollback()

	var t models.WalletTopup
	err = tx.QueryRowContext(ctx, `
		UPDATE wallet_topups SET status = $2, paid_at = now()
		WHERE reference_id = $1 AND status = $3
		RETURNING `+walletTopupColumns,
		referenceID, models.TopupStatusPaid, models.TopupStatusPending,
	).Scan(&t.ID, &t.CreatedAt, &t.UserID, &t.AmountIDR, &t.Status, &t.ReferenceID, &t.PayURL, &t.PaidAt)
	if errors.Is(err, sql.ErrNoRows) {
		return models.WalletTopup{}, false, nil
	}
	if err != nil {
		return models.WalletTopup{}, false, err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO wallet_balances (user_id, balance_idr) VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE
		SET balance_idr = wallet_balances.balance_idr + $2, updated_at = now()`,
		t.UserID, t.AmountIDR,
	); err != nil {
		return models.WalletTopup{}, false, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO wallet_transactions (user_id, kind, amount_idr, reference_type, reference_id, note)
		VALUES ($1, $2, $3, $4, $5, $6)`,
		t.UserID, models.WalletKindTopup, t.AmountIDR, "wallet_topup", t.ID, "Wallet top-up",
	); err != nil {
		return models.WalletTopup{}, false, err
	}
	if err := tx.Commit(); err != nil {
		return models.WalletTopup{}, false, err
	}
	return t, true, nil
}

// ListTopupsByUser returns one page of userID's wallet top-ups, newest first.
func (r *WalletRepository) ListTopupsByUser(ctx context.Context, userID uuid.UUID, offset, limit int) ([]models.WalletTopup, error) {
	rows, err := r.queryContext(ctx, `SELECT `+walletTopupColumns+` FROM wallet_topups
		WHERE user_id = $1 ORDER BY created_at DESC, id DESC OFFSET $2 LIMIT $3`,
		userID, offset, limit)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanWalletTopup)
}

// CountTopupsByUser returns how many wallet top-ups userID has.
func (r *WalletRepository) CountTopupsByUser(ctx context.Context, userID uuid.UUID) (int, error) {
	var total int
	err := r.queryRowContext(ctx, `SELECT count(*) FROM wallet_topups WHERE user_id = $1`, userID).Scan(&total)
	return total, err
}

// ExpireStaleTopups marks pending wallet top-ups older than a day expired;
// BorderPay expires its QRIS in an hour, so these were never paid.
func (r *WalletRepository) ExpireStaleTopups(ctx context.Context) (int64, error) {
	res, err := r.execContext(ctx, `
		UPDATE wallet_topups SET status = $1
		WHERE status = $2 AND created_at < now() - interval '24 hours'`,
		models.TopupStatusExpired, models.TopupStatusPending,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}
