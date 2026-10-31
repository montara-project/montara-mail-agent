package main

import (
	"context"
	"database/sql"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// testBilling exercises the billing module: the plans list, the guarded
// checkout, the webhook dispatching a payment across the token top-ups, the
// wallet top-ups and the subscriptions, and the daily renewal sweep.
func testBilling(t *testing.T, call callFunc, application *app.Application, db *sql.DB, userToken, userOrg string) {
	t.Helper()
	ctx := context.Background()

	var userID string
	if err := db.QueryRow(`SELECT id FROM users WHERE email = 'user@example.com'`).Scan(&userID); err != nil {
		t.Fatal(err)
	}

	// The catalog: the seed guarantees the four rows, shrunken by the
	// harness to test-sized weekly tokens.
	plansStatus, plansOut := call(http.MethodGet, "/api/v1/me/billing/plans", userToken, nil)
	if plansStatus != http.StatusOK {
		t.Fatalf("plans list: %d %v", plansStatus, plansOut)
	}
	codes := map[string]bool{}
	for _, p := range plansOut["data"].([]any) {
		row := p.(map[string]any)
		codes[row["code"].(string)] = true
	}
	for _, code := range []string{"free", "pro_monthly", "pro_yearly", "enterprise"} {
		if !codes[code] {
			t.Fatalf("plans list misses %q: %v", code, codes)
		}
	}

	// No subscription yet; the guard answers the checkout without BorderPay
	// keys: "Billing is not available on this server".
	if status, out := call(http.MethodGet, "/api/v1/me/billing/subscription", userToken, nil); status != http.StatusOK || out["data"] != nil {
		t.Fatalf("subscription: %d %v", status, out)
	}
	if status, _ := call(http.MethodPost, "/api/v1/me/billing/subscription/checkout", userToken, map[string]any{"plan_code": "pro_monthly"}); status != http.StatusServiceUnavailable {
		t.Fatalf("checkout without BorderPay: %d, want 503", status)
	}

	// The webhook dispatches to the wallet top-up: credit + ledger entry, and
	// a replay answers "already processed".
	if _, err := db.Exec(`INSERT INTO wallet_topups (user_id, amount_idr, status, reference_id)
		VALUES ($1, 50000, 'pending', 'wallet-topup-test-1')`, userID); err != nil {
		t.Fatal(err)
	}
	wh := func() (int, map[string]any) {
		return call(http.MethodPost, "/api/v1/webhooks/borderpay", "",
			map[string]any{"event": "payment.paid", "data": map[string]any{"reference_id": "wallet-topup-test-1", "status": "paid"}},
			"x-borderpay-token", "bpt_test")
	}
	if status, _ := wh(); status != http.StatusOK {
		t.Fatalf("wallet topup webhook: %d", status)
	}
	var wallet int64
	if err := db.QueryRow(`SELECT balance_idr FROM wallet_balances WHERE user_id = $1`, userID).Scan(&wallet); err != nil || wallet != 50_000 {
		t.Fatalf("wallet after top-up: %d %v", wallet, err)
	}
	var ledger int
	if err := db.QueryRow(`SELECT count(*) FROM wallet_transactions WHERE user_id = $1 AND kind = 'topup'`, userID).Scan(&ledger); err != nil || ledger != 1 {
		t.Fatalf("ledger after top-up: %d %v", ledger, err)
	}
	if status, out := wh(); status != http.StatusOK || out["message"] != "already processed" {
		t.Fatalf("wallet topup webhook replay: %d %v", status, out)
	}

	// The webhook also activates a paid subscription: status flips, the plan
	// becomes pro, the period starts; a replay changes nothing.
	if _, err := db.Exec(`INSERT INTO subscriptions (user_id, plan_id, status, amount, reference_id)
		SELECT $1, p.id, 'pending', 30000, 'sub-test-1' FROM plans p WHERE p.code = 'pro_monthly'`, userID); err != nil {
		t.Fatal(err)
	}
	subWH := func() (int, map[string]any) {
		return call(http.MethodPost, "/api/v1/webhooks/borderpay", "",
			map[string]any{"event": "payment.paid", "data": map[string]any{"reference_id": "sub-test-1", "status": "paid"}},
			"x-borderpay-token", "bpt_test")
	}
	if status, _ := subWH(); status != http.StatusOK {
		t.Fatalf("subscription webhook: %d", status)
	}
	var plan, subStatus string
	var periodStart, periodEnd sql.NullTime
	if err := db.QueryRow(`SELECT u.plan, s.status, s.current_period_start, s.current_period_end
		FROM users u JOIN subscriptions s ON s.user_id = u.id
		WHERE s.reference_id = 'sub-test-1'`).Scan(&plan, &subStatus, &periodStart, &periodEnd); err != nil {
		t.Fatal(err)
	}
	if plan != constant.PlanPro || subStatus != models.SubscriptionStatusActive || !periodStart.Valid || !periodEnd.Valid {
		t.Fatalf("activated subscription: plan=%s status=%s start=%v end=%v", plan, subStatus, periodStart, periodEnd)
	}
	if status, out := subWH(); status != http.StatusOK || out["message"] != "already processed" {
		t.Fatalf("subscription webhook replay: %d %v", status, out)
	}

	// The renewal sweep: a second, backdated subscription with enough wallet
	// balance renews (deducted, extended, ledgered)...
	if _, err := db.Exec(`UPDATE users SET plan = 'pro' WHERE id = $1`, userID); err != nil {
		t.Fatal(err)
	}
	// One live subscription per user: expire the first, activated one before
	// the next becomes active.
	if _, err := db.Exec(`UPDATE subscriptions SET status = 'expired' WHERE reference_id = 'sub-test-1'`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO subscriptions (user_id, plan_id, status, amount, reference_id,
		current_period_start, current_period_end, auto_renew)
		SELECT $1, p.id, 'active', 30000, 'sub-renew-1',
			now() - interval '2 months', now() - interval '1 hour', true
		FROM plans p WHERE p.code = 'pro_monthly'`, userID); err != nil {
		t.Fatal(err)
	}

	// Enough balance: 30000 on the wallet; the charge is 30000, with the promo
	// pinned to run past the test whatever the seeded end date is.
	if _, err := db.Exec(`UPDATE plans SET discount_amount = 20000, discount_ends_at = now() + interval '1 day'
		WHERE code = 'pro_monthly'`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO wallet_balances (user_id, balance_idr) VALUES ($1, 30000)
		ON CONFLICT (user_id) DO UPDATE SET balance_idr = 30000`, userID); err != nil {
		t.Fatal(err)
	}
	renewed, expired, err := application.Repositories.Subscription.RenewDue(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if renewed != 1 || expired != 0 {
		t.Fatalf("renewal: renewed=%d expired=%d, want 1 and 0", renewed, expired)
	}
	var endAfter, startAt sql.NullTime
	var subAmount int64
	if err := db.QueryRow(`SELECT current_period_start, current_period_end, amount
		FROM subscriptions WHERE reference_id = 'sub-renew-1'`).Scan(&startAt, &endAfter, &subAmount); err != nil {
		t.Fatal(err)
	}
	if !endAfter.Valid || !endAfter.Time.After(time.Now().Add(20*24*time.Hour)) {
		t.Fatalf("renewal period end: %v, want about a month out", endAfter)
	}
	if subAmount != 30000 {
		t.Fatalf("renewal amount snapshot: %d, want 30000", subAmount)
	}
	var walletAfter int64
	if err := db.QueryRow(`SELECT balance_idr FROM wallet_balances WHERE user_id = $1`, userID).Scan(&walletAfter); err != nil || walletAfter != 0 {
		t.Fatalf("wallet after renewal: %d %v", walletAfter, err)
	}
	var charges int
	if err := db.QueryRow(`SELECT count(*) FROM wallet_transactions WHERE user_id = $1 AND kind = 'subscription_charge'`, userID).Scan(&charges); err != nil || charges != 1 {
		t.Fatalf("renewal ledger: %d %v", charges, err)
	}

	// ...and a subscription whose wallet cannot cover it expires with the
	// plan downgraded to free, same day.
	var otherUser string
	if err := db.QueryRow(`INSERT INTO users (id, name, email, role, plan)
		VALUES (uuidv7(), 'Billing User', 'billing-user@example.com', 'user', 'pro')
		RETURNING id`).Scan(&otherUser); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO subscriptions (user_id, plan_id, status, amount, reference_id,
		current_period_start, current_period_end, auto_renew)
		SELECT $1, p.id, 'active', 30000, 'sub-renew-2',
			now() - interval '2 months', now() - interval '1 hour', true
		FROM plans p WHERE p.code = 'pro_monthly'`, otherUser); err != nil {
		t.Fatal(err)
	}
	renewed, expired, err = application.Repositories.Subscription.RenewDue(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if renewed != 0 || expired != 1 {
		t.Fatalf("empty-wallet renewal: renewed=%d expired=%d, want 0 and 1", renewed, expired)
	}
	var downgraded string
	if err := db.QueryRow(`SELECT plan FROM users WHERE id = $1`, otherUser).Scan(&downgraded); err != nil {
		t.Fatal(err)
	}
	if downgraded != constant.PlanFree {
		t.Fatalf("empty-wallet user plan: %s, want free", downgraded)
	}

	// A plan without a promo still renews: its discount reads NULL. Sweeps racing
	// over it, like replicas in a rolling deploy, charge the wallet only once.
	if _, err := db.Exec(`UPDATE plans SET discount_amount = NULL WHERE code = 'pro_monthly'`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO wallet_balances (user_id, balance_idr) VALUES ($1, 500000)`, otherUser); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO subscriptions (user_id, plan_id, status, amount, reference_id,
		current_period_start, current_period_end, auto_renew)
		SELECT $1, p.id, 'active', 50000, 'sub-renew-3',
			now() - interval '2 months', now() - interval '1 hour', true
		FROM plans p WHERE p.code = 'pro_monthly'`, otherUser); err != nil {
		t.Fatal(err)
	}
	var sweeps sync.WaitGroup
	for range 4 {
		sweeps.Go(func() {
			if _, _, err := application.Repositories.Subscription.RenewDue(ctx); err != nil {
				t.Error(err)
			}
		})
	}
	sweeps.Wait()
	var afterRace int64
	if err := db.QueryRow(`SELECT balance_idr FROM wallet_balances WHERE user_id = $1`, otherUser).Scan(&afterRace); err != nil || afterRace != 450_000 {
		t.Fatalf("wallet after racing sweeps: %d %v, want 450000", afterRace, err)
	}
	if _, err := db.Exec(`UPDATE plans SET discount_amount = 20000 WHERE code = 'pro_monthly'`); err != nil {
		t.Fatal(err)
	}

	// The renewal switch stamps when it went off, and clears it when back on.
	autoRenewOff := func(enabled, wantStamped bool) {
		t.Helper()
		if err := application.Repositories.Subscription.SetAutoRenew(ctx, uuid.MustParse(otherUser), enabled); err != nil {
			t.Fatal(err)
		}
		var canceled sql.NullTime
		if err := db.QueryRow(`SELECT canceled_at FROM subscriptions WHERE reference_id = 'sub-renew-3'`).Scan(&canceled); err != nil {
			t.Fatal(err)
		}
		if canceled.Valid != wantStamped {
			t.Fatalf("auto-renew %v: canceled_at %v, want stamped=%v", enabled, canceled, wantStamped)
		}
	}
	autoRenewOff(false, true)
	autoRenewOff(true, false)

	// A checkout past its QRIS gives way to a new one; a recent one stays.
	var abandonedOwner string
	if err := db.QueryRow(`INSERT INTO users (id, name, email, role, plan)
		VALUES (uuidv7(), 'Checkout User', 'checkout-user@example.com', 'user', 'free')
		RETURNING id`).Scan(&abandonedOwner); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO subscriptions (user_id, plan_id, status, amount, reference_id, created_at)
		SELECT $1, p.id, 'pending', 30000, 'sub-abandoned', now() - interval '3 hours'
		FROM plans p WHERE p.code = 'pro_monthly'`, abandonedOwner); err != nil {
		t.Fatal(err)
	}
	abandonedStatus := func(age time.Duration) string {
		t.Helper()
		if err := application.Repositories.Subscription.ExpirePending(ctx, uuid.MustParse(abandonedOwner), age); err != nil {
			t.Fatal(err)
		}
		var status string
		if err := db.QueryRow(`SELECT status FROM subscriptions WHERE reference_id = 'sub-abandoned'`).Scan(&status); err != nil {
			t.Fatal(err)
		}
		return status
	}
	if got := abandonedStatus(4 * time.Hour); got != models.SubscriptionStatusPending {
		t.Fatalf("recent checkout: %s, want pending", got)
	}
	if got := abandonedStatus(2 * time.Hour); got != models.SubscriptionStatusExpired {
		t.Fatalf("abandoned checkout: %s, want expired", got)
	}

	// Caps: back on free, the next organization is refused once the user
	// owns the free tier's 2. Top up to the cap first, so the test holds no
	// matter what the earlier flows created.
	if _, err := db.Exec(`UPDATE users SET plan = 'free' WHERE id = $1`, userID); err != nil {
		t.Fatal(err)
	}
	ownedCount := func() int {
		t.Helper()
		var owned int
		if err := db.QueryRow(`SELECT count(*) FROM organization_members m
			JOIN organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL
			WHERE m.user_id = $1 AND m.role = 'owner'`, userID).Scan(&owned); err != nil {
			t.Fatal(err)
		}
		return owned
	}
	for ownedCount() < 2 {
		if status, _ := call(http.MethodPost, "/api/v1/organizations", userToken,
			map[string]any{"name": "Cap Org"}, "X-Idempotency-Key", uuid.NewString()); status != http.StatusCreated {
			t.Fatalf("org below the cap: %d", status)
		}
	}
	if status, _ := call(http.MethodPost, "/api/v1/organizations", userToken,
		map[string]any{"name": "Cap Org Over"}, "X-Idempotency-Key", "22222222-2222-4222-8222-222222222222"); status != http.StatusForbidden {
		t.Fatalf("org over the cap: %d, want 403", status)
	}

	// Mailboxes: the free cap is 20 across the user's organizations. 19 more
	// (one exists from the mail flow) reach the cap; the 21st is refused.
	var have int
	if err := db.QueryRow(`SELECT count(DISTINCT ea.id) FROM email_accounts ea
		JOIN organization_members m ON m.organization_id = ea.organization_id
		WHERE m.user_id = $1`, userID).Scan(&have); err != nil {
		t.Fatal(err)
	}
	for i := have; i < 20; i++ {
		if _, err := db.Exec(`INSERT INTO email_accounts (id, organization_id, email, password)
			VALUES (uuidv7(), $1, $2, 'x')`, userOrg, "cap-test-"+string(rune('a'+i%26))+string(rune('0'+i/26))+"@example.com"); err != nil {
			t.Fatal(err)
		}
	}
	if status, _ := call(http.MethodPost, "/api/v1/organizations/"+userOrg+"/email-accounts", userToken,
		map[string]any{"email": "mailbox-21@example.com", "host": "imap.example.com", "password": "secret123", "port": 993}); status != http.StatusForbidden {
		t.Fatalf("21st mailbox on free: %d, want 403", status)
	}
	if _, err := db.Exec(`DELETE FROM email_accounts WHERE email LIKE 'cap-test-%'`); err != nil {
		t.Fatal(err)
	}
}
