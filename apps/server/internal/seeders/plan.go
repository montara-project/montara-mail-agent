package seeders

import (
	"context"
	"database/sql"
	"time"
)

// promoEndsAt is when the launch promo ends: end of 2026, WIB.
var promoEndsAt = time.Date(2026, 12, 31, 23, 59, 59, 0, time.FixedZone("WIB", 7*3600))

// seedPlan is one pricing row the seeder guarantees to exist.
type seedPlan struct {
	code, name, description string
	interval                *string
	amount                  int64
	discount                int64
	maxEmailAccounts        *int
	maxOrganizations        *int
	weeklyTokens            *int64
	sortOrder               int
}

func intPtr(v int) *int       { return &v }
func int64Ptr(v int64) *int64 { return &v }

// planRows returns the catalog the product ships: the Free tier, both Pro
// billing intervals with the launch promo (20k off the monthly 50k, 250k off
// the yearly 500k, until the end of 2026), and the contact-only Enterprise.
func planRows() []seedPlan {
	month := "month"
	year := "year"
	return []seedPlan{
		{
			code: "free", name: "Free",
			description:      "The essentials: 20 mailboxes, 2 organizations, 10M tokens a week.",
			amount:           0,
			maxEmailAccounts: intPtr(20),
			maxOrganizations: intPtr(2),
			weeklyTokens:     int64Ptr(10_000_000),
		},
		{
			code: "pro_monthly", name: "Pro",
			description:      "Unlimited mailboxes, 10 organizations, 100M tokens a week.",
			interval:         &month,
			amount:           50_000,
			discount:         20_000,
			maxOrganizations: intPtr(10),
			weeklyTokens:     int64Ptr(100_000_000),
			sortOrder:        1,
		},
		{
			code: "pro_yearly", name: "Pro",
			description:      "Unlimited mailboxes, 10 organizations, 100M tokens a week, two months free.",
			interval:         &year,
			amount:           500_000,
			discount:         250_000,
			maxOrganizations: intPtr(10),
			weeklyTokens:     int64Ptr(100_000_000),
		},
		{
			code: "enterprise", name: "Enterprise",
			description: "Unlimited everything, billed per contract. Talk to us.",
			amount:      0,
			sortOrder:   3,
		},
	}
}

// PlanSeeder guarantees the pricing catalog exists: it inserts every row the
// product ships and leaves existing rows untouched, so an admin's edits
// survive re-seeding.
type PlanSeeder struct{ DB *sql.DB }

func (s PlanSeeder) Name() string { return "plans" }

// Seed inserts the catalog rows that are missing; ON CONFLICT DO NOTHING
// keeps any edit an admin made to a row.
func (s PlanSeeder) Seed() error {
	return runSeed(s.DB, func(ctx context.Context, tx *sql.Tx) error {
		for _, p := range planRows() {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO plans (code, name, description, billing_interval, amount, currency,
					discount_amount, discount_ends_at, max_email_accounts, max_organizations,
					weekly_tokens, sort_order)
				VALUES ($1, $2, $3, $4, $5, 'IDR', $6, $7, $8, $9, $10, $11)
				ON CONFLICT (code) DO NOTHING`,
				p.code, p.name, p.description, p.interval, p.amount,
				nullableDiscount(p.discount), promoEndsAt,
				p.maxEmailAccounts, p.maxOrganizations, p.weeklyTokens, p.sortOrder,
			); err != nil {
				return err
			}
		}
		return nil
	})
}

// nullableDiscount maps 0 (no promo) to SQL NULL.
func nullableDiscount(v int64) any {
	if v <= 0 {
		return nil
	}
	return v
}
