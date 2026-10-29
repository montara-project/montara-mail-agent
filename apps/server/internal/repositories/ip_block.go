package repositories

import (
	"context"
	"time"

	"github.com/google/uuid"

	"montara-mail-agent/server/internal/models"
)

// IPBlockRepository manages the blocked addresses (see migration 0014).
type IPBlockRepository struct {
	BaseRepository
}

const ipBlockColumns = `b.id, b.created_at, b.updated_at, b.network::text, b.source, b.reason, b.expires_at, b.created_by, u.email`

func scanIPBlock(row rowScanner) (models.IPBlock, error) {
	var b models.IPBlock
	err := row.Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt, &b.Network, &b.Source, &b.Reason, &b.ExpiresAt, &b.CreatedBy, &b.CreatedByEmail)
	return b, translateNotFound("ip_blocks", err)
}

// Active lists the blocks in force, newest first.
func (r *IPBlockRepository) Active(ctx context.Context) ([]models.IPBlock, error) {
	rows, err := r.queryContext(ctx, `
		SELECT `+ipBlockColumns+` FROM ip_blocks b LEFT JOIN users u ON u.id = b.created_by
		WHERE b.expires_at IS NULL OR b.expires_at > now()
		ORDER BY b.created_at DESC`)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanIPBlock)
}

// Get returns one block.
func (r *IPBlockRepository) Get(ctx context.Context, id uuid.UUID) (models.IPBlock, error) {
	return scanIPBlock(r.queryRowContext(ctx, `
		SELECT `+ipBlockColumns+` FROM ip_blocks b LEFT JOIN users u ON u.id = b.created_by
		WHERE b.id = $1`, id))
}

// BlockManual blocks network until expiresAt (nil: until removed), replacing
// any block of the same network, an automatic one included.
func (r *IPBlockRepository) BlockManual(ctx context.Context, network, reason string, expiresAt *time.Time, by uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.queryRowContext(ctx, `
		INSERT INTO ip_blocks (network, source, reason, expires_at, created_by)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (network) DO UPDATE SET source = EXCLUDED.source, reason = EXCLUDED.reason,
			expires_at = EXCLUDED.expires_at, created_by = EXCLUDED.created_by, created_at = now(), updated_at = now()
		RETURNING id`,
		network, models.IPBlockManual, reason, expiresAt, by,
	).Scan(&id)
	return id, err
}

// BlockAuto blocks network until expiresAt for the server itself. A manual
// block of the same network is left as the super user set it.
func (r *IPBlockRepository) BlockAuto(ctx context.Context, network, reason string, expiresAt time.Time) error {
	_, err := r.execContext(ctx, `
		INSERT INTO ip_blocks (network, source, reason, expires_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (network) DO UPDATE SET reason = EXCLUDED.reason, expires_at = EXCLUDED.expires_at,
			created_at = now(), updated_at = now()
		WHERE ip_blocks.source = $2`,
		network, models.IPBlockAuto, reason, expiresAt,
	)
	return err
}

// Delete lifts one block.
func (r *IPBlockRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM ip_blocks WHERE id = $1`, id)
	if err != nil {
		return err
	}
	return requireAffected(res, "ip_blocks")
}

// DeleteExpired drops the blocks whose time ran out.
func (r *IPBlockRepository) DeleteExpired(ctx context.Context) error {
	_, err := r.execContext(ctx, `DELETE FROM ip_blocks WHERE expires_at <= now()`)
	return err
}
