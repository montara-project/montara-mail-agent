package seeders

import (
	"context"
	"database/sql"
	"montara-mail-agent/server/internal/config"
	"montara-mail-agent/server/internal/lib"
	"time"
)

// All returns every seeder that needs only the database, referenced rows
// first. The super user needs a
// running Authula instance, so the API appends SuperUserSeeder itself.
func All(db *sql.DB) []Seeder {
	// The plans are for sale on the Cloud Edition only.
	if config.Community() {
		return nil
	}
	return []Seeder{PlanSeeder{DB: db}}
}

// runSeed executes fn in one transaction, so a seeder either applies
// completely or not at all.
func runSeed(db *sql.DB, fn func(ctx context.Context, tx *sql.Tx) error) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	return lib.WithTransaction(ctx, db, func(tx *sql.Tx) error {
		// Serializes seeders across processes: replicas seeding on boot at the
		// same time would otherwise both pass the assignment NOT EXISTS check.
		if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext('montara-mail-agent:seed'))`); err != nil {
			return err
		}
		return fn(ctx, tx)
	})
}
