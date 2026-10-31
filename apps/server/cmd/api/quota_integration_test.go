package main

import (
	"context"
	"database/sql"
	"net/http"
	"testing"
	"time"

	"montara-mail-agent/server/internal/app"
	"montara-mail-agent/server/internal/models"
)

// testTokenQuota exercises the token quota: the weekly allowance blocks the
// AI endpoints at 402 once spent, a BorderPay top-up webhook credits the
// pay-as-you-go balance exactly once, and the balance unblocks the call.
func testTokenQuota(t *testing.T, call callFunc, application *app.Application, db *sql.DB, userToken, superToken, userOrg string) {
	t.Helper()

	// The plain user's id, for direct row inserts.
	var userID string
	if err := db.QueryRow(`SELECT id FROM users WHERE email = 'user@example.com'`).Scan(&userID); err != nil {
		t.Fatal(err)
	}

	// Status: free plan, nothing used, no balance.
	status, out := call(http.MethodGet, "/api/v1/me/quota", userToken, nil)
	if status != http.StatusOK || out["data"].(map[string]any)["plan"] != "free" || out["data"].(map[string]any)["limit_tokens"] == nil {
		t.Fatalf("quota status: %d %v", status, out)
	}

	// A platform provider is a super user's business.
	if status, _ := call(http.MethodPut, "/api/v1/llm-providers/platform", userToken, map[string]any{"kind": "openai", "model": "m", "api_key": "sk-x", "base_url": "https://llm.example.com/v1"}); status != http.StatusForbidden {
		t.Fatalf("platform provider as a plain user: %d, want 403", status)
	}
	if status, out := call(http.MethodPut, "/api/v1/llm-providers/platform", superToken, map[string]any{"kind": "openai", "model": "m", "api_key": "sk-x", "base_url": "https://llm.example.com/v1"}); status != http.StatusOK || data(out)["has_api_key"] != true {
		t.Fatalf("platform provider as super user: %d %v", status, out)
	}
	if status, _ := call(http.MethodDelete, "/api/v1/llm-providers/platform", superToken, nil); status != http.StatusOK {
		t.Fatalf("platform provider delete: %d, want 200", status)
	}

	// Spend past the test's weekly limit: summary answers 402 before it
	// reaches the model.
	account := seedAccount(t, application, userOrg, models.Mail{Subject: "Quota mail", Body: "x", FromEmail: "a@b.c"})
	var mailID string
	if err := db.QueryRow(`SELECT id FROM mails WHERE email_account_id = $1 LIMIT 1`, account.ID).Scan(&mailID); err != nil {
		t.Fatal(err)
	}
	// 1200 tokens against the test's 1000 allowance: 200 past it.
	_, err := db.Exec(`INSERT INTO token_usage (user_id, provider, model, purpose, input_tokens, output_tokens)
		VALUES ($1, 'openai', 'm', 'complete', 600, 600)`, userID)
	if err != nil {
		t.Fatal(err)
	}
	if status, _ := call(http.MethodPost, "/api/v1/mails/"+mailID+"/summary", userToken, nil); status != http.StatusPaymentRequired {
		t.Fatalf("summary with a spent quota: %d, want 402", status)
	}

	// The webhook verifies its shared token first.
	pending := models.TokenTopup{ReferenceID: "topup-test-1", Tokens: 500, Status: models.TopupStatusPending}
	if _, err := db.Exec(`INSERT INTO token_topups (user_id, amount_idr, tokens, status, reference_id)
		VALUES ($1, 10000, 500, 'pending', 'topup-test-1')`, userID); err != nil {
		t.Fatal(err)
	}
	_ = pending

	// The history pages: 12 top-ups, newest first, 10 to a page by default.
	if _, err := db.Exec(`INSERT INTO token_topups (user_id, amount_idr, tokens, status, reference_id)
		SELECT $1, 10000, 500, 'expired', 'topup-page-' || n FROM generate_series(1, 11) n`, userID); err != nil {
		t.Fatal(err)
	}
	topupPage := func(query string) (rows int, total any) {
		t.Helper()
		status, out := call(http.MethodGet, "/api/v1/me/quota/topups"+query, userToken, nil)
		list, _ := out["data"].([]any)
		if status != http.StatusOK {
			t.Fatalf("top-ups%s: %d %v", query, status, out)
		}
		return len(list), out["metadata"].(map[string]any)["total"]
	}
	if rows, total := topupPage(""); rows != 10 || total != float64(12) {
		t.Fatalf("first page: %d rows of %v, want 10 of 12", rows, total)
	}
	if rows, total := topupPage("?offset=10&limit=5"); rows != 2 || total != float64(12) {
		t.Fatalf("last page: %d rows of %v, want 2 of 12", rows, total)
	}
	if status, _ := call(http.MethodPost, "/api/v1/webhooks/borderpay", "", map[string]any{
		"event": "payment.paid", "data": map[string]any{"reference_id": "topup-test-1", "status": "paid"},
	}); status != http.StatusUnauthorized {
		t.Fatalf("webhook without the token: %d, want 401", status)
	}
	if status, _ := call(http.MethodPost, "/api/v1/webhooks/borderpay", "", map[string]any{
		"event": "payment.paid", "data": map[string]any{"reference_id": "topup-test-1", "status": "paid"},
	}, "x-borderpay-token", "wrong"); status != http.StatusUnauthorized {
		t.Fatalf("webhook with a wrong token: %d, want 401", status)
	}
	if status, _ := call(http.MethodPost, "/api/v1/webhooks/borderpay", "", map[string]any{
		"event": "payment.paid", "data": map[string]any{"reference_id": "topup-test-1", "status": "paid"},
	}, "x-borderpay-token", "bpt_test"); status != http.StatusOK {
		t.Fatalf("webhook paid: %d, want 200", status)
	}

	// The balance shows what is left after the overflow it covered (500
	// credited, 200 spent past the allowance), and the AI endpoint passes the
	// quota again (it fails later on the unreachable mail server instead).
	status, out = call(http.MethodGet, "/api/v1/me/quota", userToken, nil)
	if status != http.StatusOK || out["data"].(map[string]any)["payg_balance_tokens"].(float64) != 300 {
		t.Fatalf("balance after the webhook: %d %v", status, out)
	}
	if status, _ := call(http.MethodPost, "/api/v1/mails/"+mailID+"/summary", userToken, nil); status == http.StatusPaymentRequired {
		t.Fatalf("summary with balance: %d, the pay-as-you-go balance did not unblock the quota", status)
	}

	// A replay credits nothing twice.
	if status, _ := call(http.MethodPost, "/api/v1/webhooks/borderpay", "", map[string]any{
		"event": "payment.paid", "data": map[string]any{"reference_id": "topup-test-1", "status": "paid"},
	}, "x-borderpay-token", "bpt_test"); status != http.StatusOK {
		t.Fatalf("webhook replay: %d, want 200", status)
	}
	status, out = call(http.MethodGet, "/api/v1/me/quota", userToken, nil)
	if status != http.StatusOK || out["data"].(map[string]any)["payg_balance_tokens"].(float64) != 300 {
		t.Fatalf("balance after the replay: %d %v", status, out)
	}

	// The free plan caps mailboxes per user across organizations.
	for range 20 {
		seedAccount(t, application, userOrg)
	}
	if status, _ := call(http.MethodPost, "/api/v1/organizations/"+userOrg+"/email-accounts", userToken, map[string]any{
		"provider": "imap", "label": "One too many", "email": "extra@example.com",
		"username": "extra@example.com", "password": "pw",
		"imap_host": "127.0.0.1", "imap_port": 9, "smtp_host": "127.0.0.1", "smtp_port": 9,
	}); status != http.StatusForbidden {
		t.Fatalf("the 21st mailbox: %d, want 403", status)
	}

	// The sweep folds an old week's overflow once and deletes its rows, so a
	// second sweep finds nothing to charge again.
	if _, err := db.Exec(`INSERT INTO token_usage (user_id, provider, model, purpose, input_tokens, output_tokens, created_at)
		VALUES ($1, 'p', 'm', 'test', 100, 50, now() - interval '28 days')`, userID); err != nil {
		t.Fatal(err)
	}
	storedBalance := func() int64 {
		t.Helper()
		var stored int64
		if err := db.QueryRow(`SELECT balance_tokens FROM token_balances WHERE user_id = $1`, userID).Scan(&stored); err != nil {
			t.Fatal(err)
		}
		return stored
	}
	before := storedBalance()
	sweep := func() int64 {
		t.Helper()
		limit := int64(100)
		deleted, err := application.Repositories.TokenBalance.FoldAndDeleteOldUsage(context.Background(), time.Now(), &limit, &limit, &limit)
		if err != nil {
			t.Fatal(err)
		}
		return deleted
	}
	if deleted := sweep(); deleted != 1 || storedBalance() != before-50 {
		t.Fatalf("first sweep: deleted %d, stored %d, want 1 and %d", deleted, storedBalance(), before-50)
	}
	if deleted := sweep(); deleted != 0 || storedBalance() != before-50 {
		t.Fatalf("second sweep: deleted %d, stored %d, want 0 and %d", deleted, storedBalance(), before-50)
	}
}
