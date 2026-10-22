package seeders

import (
	"context"
	"database/sql"

	"montara-mail-agent/server/internal/lib/constant"
)

type OrganizationSeeder struct {
	DB *sql.DB
}

func (s OrganizationSeeder) Name() string {
	return "organization"
}

// Seed inserts the default organization; an existing id is left untouched.
func (s OrganizationSeeder) Seed() error {
	return runSeed(s.DB, func(ctx context.Context, tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx,
			`INSERT INTO "organizations" ("id", "name") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING`,
			constant.OrganizationPersonalID, "Personal",
		)
		return err
	})
}
