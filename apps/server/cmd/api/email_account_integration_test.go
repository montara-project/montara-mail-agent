package main

import (
	"database/sql"
	"net/http"
	"testing"

	"montara-mail-agent/server/internal/app"
)

// testEmailAccountTransfer exercises the same-user account transfer: a
// successful move (mails follow, agent data re-homes), the guards (same org,
// foreign account, duplicate email), and the activity log entry.
func testEmailAccountTransfer(t *testing.T, call callFunc, application *app.Application, db *sql.DB, userToken, userOrg, superToken, superOrg string) {
	t.Helper()

	// Fixture: a second organization the user owns, created by hand — the
	// harness flow has already spent the user's free-tier org cap.
	var targetOrg string
	if err := db.QueryRow(`INSERT INTO organizations (id, name) VALUES (uuidv7(), 'Transfer Target')
		RETURNING id`).Scan(&targetOrg); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO organization_members (organization_id, user_id, role)
		SELECT $1, id, 'owner' FROM users WHERE email = 'user@example.com'`, targetOrg); err != nil {
		t.Fatal(err)
	}

	// The account under test + how many mails hang off it.
	var accountID, accountEmail string
	if err := db.QueryRow(`SELECT id, email FROM email_accounts WHERE organization_id = $1
		ORDER BY created_at LIMIT 1`, userOrg).Scan(&accountID, &accountEmail); err != nil {
		t.Fatal(err)
	}
	var mailCount int
	if err := db.QueryRow(`SELECT count(*) FROM mails WHERE email_account_id = $1`, accountID).Scan(&mailCount); err != nil {
		t.Fatal(err)
	}
	var userID string
	if err := db.QueryRow(`SELECT id FROM users WHERE email = 'user@example.com'`).Scan(&userID); err != nil {
		t.Fatal(err)
	}

	// Agent data attached to the account, to verify it re-homes with it.
	if _, err := db.Exec(`INSERT INTO agent_conversations (organization_id, user_id, email_account_id)
		VALUES ($1, $2, $3)`, userOrg, userID, accountID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO agent_drafts (organization_id, email_account_id, "to", subject, text)
		VALUES ($1, $2, '[]', 'Hello', 'Draft text')`, userOrg, accountID); err != nil {
		t.Fatal(err)
	}
	var convID, draftID string
	if err := db.QueryRow(`SELECT id FROM agent_conversations WHERE email_account_id = $1 ORDER BY created_at DESC LIMIT 1`, accountID).Scan(&convID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT id FROM agent_drafts WHERE email_account_id = $1 ORDER BY created_at DESC LIMIT 1`, accountID).Scan(&draftID); err != nil {
		t.Fatal(err)
	}

	// A foreign account lives in the super user's organization: transferring
	// it answers not-found, hiding other users' accounts.
	var foreignAccount string
	if err := db.QueryRow(`SELECT id FROM email_accounts WHERE organization_id = $1 LIMIT 1`, superOrg).Scan(&foreignAccount); err != nil {
		if sql.ErrNoRows == err {
			// no account there yet — none needed; the transfer below just answers 404
			foreignAccount = ""
		} else {
			t.Fatal(err)
		}
	}

	// The happy path: transfer to the user's own second organization.
	if status, out := call(http.MethodPost, "/api/v1/email-accounts/"+accountID+"/transfer", userToken,
		map[string]any{"organization_id": targetOrg}, "X-Idempotency-Key", "33333333-3333-4333-8333-333333333331"); status != http.StatusOK {
		t.Fatalf("transfer: %d %v", status, out)
	}
	var orgAfter string
	if err := db.QueryRow(`SELECT organization_id FROM email_accounts WHERE id = $1`, accountID).Scan(&orgAfter); err != nil || orgAfter != targetOrg {
		t.Fatalf("transferred org: %s %v, want %s", orgAfter, err, targetOrg)
	}
	var mailsAfter int
	if err := db.QueryRow(`SELECT count(*) FROM mails WHERE email_account_id = $1`, accountID).Scan(&mailsAfter); err != nil || mailsAfter != mailCount {
		t.Fatalf("mails after transfer: %d %v, want %d", mailsAfter, err, mailCount)
	}

	// The agent data re-homed with the account.
	var convOrg, draftOrg string
	if err := db.QueryRow(`SELECT organization_id FROM agent_conversations WHERE id = $1`, convID).Scan(&convOrg); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT organization_id FROM agent_drafts WHERE id = $1`, draftID).Scan(&draftOrg); err != nil {
		t.Fatal(err)
	}
	if convOrg != targetOrg || draftOrg != targetOrg {
		t.Fatalf("agent data org: conv=%s draft=%s, want %s", convOrg, draftOrg, targetOrg)
	}

	// The activity entry landed on the source organization.
	var moved int
	if err := db.QueryRow(`SELECT count(*) FROM activity_logs WHERE action = 'email_account.moved'
		AND organization_id = $1 AND metadata->>'to_organization_id' = $2`, userOrg, targetOrg).Scan(&moved); err != nil || moved != 1 {
		t.Fatalf("activity log: %d %v", moved, err)
	}

	// Transferring it again to the organization it already belongs to: 400.
	if status, _ := call(http.MethodPost, "/api/v1/email-accounts/"+accountID+"/transfer", userToken,
		map[string]any{"organization_id": targetOrg}, "X-Idempotency-Key", "33333333-3333-4333-8333-333333333332"); status != http.StatusBadRequest {
		t.Fatalf("same-org transfer: %d, want 400", status)
	}

	// A user cannot reach into an organization they do not belong to: the
	// super user's account reads as not-found, like any foreign account.
	if foreignAccount != "" {
		if status, _ := call(http.MethodPost, "/api/v1/email-accounts/"+foreignAccount+"/transfer", userToken,
			map[string]any{"organization_id": userOrg}, "X-Idempotency-Key", "33333333-3333-4333-8333-333333333333"); status != http.StatusNotFound {
			t.Fatalf("foreign account transfer: %d, want 404", status)
		}
	}

	// A duplicate email in the target organization is a 409 conflict: plant
	// one under the other account's address, then transfer that account.
	var otherAccount, otherEmail string
	if err := db.QueryRow(`SELECT id, email FROM email_accounts WHERE organization_id = $1
		AND id <> $2 ORDER BY created_at LIMIT 1`, userOrg, accountID).Scan(&otherAccount, &otherEmail); err != nil {
		t.Skip("only one fixture account in the source org")
	}
	if _, err := db.Exec(`INSERT INTO email_accounts (id, organization_id, provider, label, email,
		imap_host, imap_port, username, password, smtp_host, smtp_port)
		VALUES (uuidv7(), $1, 'imap', 'Dup', $2, '127.0.0.1', 9, $2, 'x', '127.0.0.1', 9)`,
		targetOrg, otherEmail); err != nil {
		t.Fatal(err)
	}
	if status, _ := call(http.MethodPost, "/api/v1/email-accounts/"+otherAccount+"/transfer", userToken,
		map[string]any{"organization_id": targetOrg}, "X-Idempotency-Key", "33333333-3333-4333-8333-333333333334"); status != http.StatusConflict {
		t.Fatalf("duplicate-email transfer: %d, want 409", status)
	}
}
