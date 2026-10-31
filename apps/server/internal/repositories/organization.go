package repositories

import (
	"context"
	"fmt"

	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"

	"github.com/google/uuid"
)

// OrganizationRepository manages organizations.
type OrganizationRepository struct {
	BaseRepository
}

const organizationColumns = `
	id, created_at, updated_at, deleted_at, name`

func scanOrganization(row rowScanner) (models.Organization, error) {
	var c models.Organization
	err := row.Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt, &c.DeletedAt, &c.Name)
	return c, translateNotFound("organizations", err)
}

// Insert persists a new organization with ownerID as its owner, in one
// transaction so an organization never exists without its owner.
func (r *OrganizationRepository) Insert(ctx context.Context, c models.Organization, ownerID uuid.UUID) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `INSERT INTO organizations (id, name) VALUES ($1, $2)`, c.ID, c.Name); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO organization_members (organization_id, user_id, role)
		VALUES ($1, $2, $3)`,
		c.ID, ownerID, constant.MemberRoleOwner,
	); err != nil {
		return err
	}
	return tx.Commit()
}

// MemberRole returns userID's role in an organization, trashed or not, or a
// not-found error when the user is no member.
func (r *OrganizationRepository) MemberRole(ctx context.Context, organizationID, userID uuid.UUID) (string, error) {
	var role string
	err := r.queryRowContext(ctx, `
		SELECT role FROM organization_members
		WHERE organization_id = $1 AND user_id = $2`,
		organizationID, userID,
	).Scan(&role)
	return role, translateNotFound("organization_members", err)
}

// EnsurePersonalOrganization gives userID their own organization when they
// have none: "<name>'s Workspace", with them as its owner. The advisory lock
// makes concurrent first logins pick one winner, and a user who already has a
// membership is left untouched. The name comes from the users mirror table.
func (r *OrganizationRepository) EnsurePersonalOrganization(ctx context.Context, userID uuid.UUID) error {
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// One creator wins the race of two simultaneous first logins.
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, userID.String()); err != nil {
		return err
	}

	var memberships int
	if err := tx.QueryRowContext(ctx, `
		SELECT count(*) FROM organization_members WHERE user_id = $1`,
		userID,
	).Scan(&memberships); err != nil {
		return err
	}
	if memberships > 0 {
		return tx.Commit()
	}

	id, err := uuid.NewV7()
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO organizations (id, name)
		SELECT $1, COALESCE(NULLIF(TRIM(name), '') || '''s Workspace', 'My Workspace')
		FROM users WHERE id = $2`,
		id, userID,
	); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO organization_members (organization_id, user_id, role)
		VALUES ($1, $2, $3)`,
		id, userID, constant.MemberRoleOwner,
	); err != nil {
		return err
	}
	return tx.Commit()
}

// organizationSortColumns whitelists the columns a `sorted` value may order by.
var organizationSortColumns = map[string]string{
	"name":       "name",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// organizationFilters builds the WHERE conditions shared by List and Count.
// A memberID limits them to that user's organizations; uuid.Nil lists all.
func organizationFilters(p ListParams, memberID uuid.UUID) *whereBuilder {
	w := newWhere(`deleted_at IS NULL`)
	w.search(p.Search, "name")
	if memberID != uuid.Nil {
		w.add(`id IN (SELECT organization_id FROM organization_members WHERE user_id = $%d)`, memberID)
	}
	return w
}

// List returns one page of live organizations, optionally filtered by a
// case-insensitive name search and to memberID's organizations, ordered by
// p.Sorted. Callers clamp the offset/limit first (see dtos.ListQuery.Clamp).
func (r *OrganizationRepository) List(ctx context.Context, p ListParams, memberID uuid.UUID) ([]models.Organization, error) {
	where, args, limit, offset := organizationFilters(p, memberID).page(p)

	query := fmt.Sprintf(`
		SELECT %s FROM organizations
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d`,
		organizationColumns, where,
		resolveOrder(p.Sorted, organizationSortColumns, "created_at DESC"), limit, offset)

	rows, err := r.queryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, scanOrganization)
}

// LiveIDs returns the id of every organization not deleted, for background
// jobs that walk them all.
func (r *OrganizationRepository) LiveIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := r.queryContext(ctx, `SELECT id FROM organizations WHERE deleted_at IS NULL`)
	if err != nil {
		return nil, err
	}
	return collectRows(rows, func(row rowScanner) (uuid.UUID, error) {
		var id uuid.UUID
		err := row.Scan(&id)
		return id, err
	})
}

// Count returns how many live organizations match the List filters, for the
// response meta block.

// CountOwned returns how many live organizations the user owns (role owner
// in organization_members); the organization cap counts these.
func (r *OrganizationRepository) CountOwned(ctx context.Context, userID uuid.UUID) (int, error) {
	var n int
	err := r.queryRowContext(ctx, `
		SELECT count(*) FROM organization_members m
		JOIN organizations o ON o.id = m.organization_id AND o.deleted_at IS NULL
		WHERE m.user_id = $1 AND m.role = $2`,
		userID, constant.MemberRoleOwner,
	).Scan(&n)
	return n, translateNotFound("organization_members", err)
}
func (r *OrganizationRepository) Count(ctx context.Context, p ListParams, memberID uuid.UUID) (int64, error) {
	return r.countRows(ctx, "organizations", organizationFilters(p, memberID))
}

// Get returns one live organization by id.
func (r *OrganizationRepository) Get(ctx context.Context, id uuid.UUID) (models.Organization, error) {
	query := fmt.Sprintf(`SELECT %s FROM organizations WHERE id = $1 AND deleted_at IS NULL`, organizationColumns)
	return scanOrganization(r.queryRowContext(ctx, query, id))
}

// Update rewrites a organization.
func (r *OrganizationRepository) Update(ctx context.Context, c models.Organization) error {
	res, err := r.execContext(ctx, `
		UPDATE organizations
		SET name = $2, updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		c.ID, c.Name,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization")
}

// Delete soft-removes one organization by stamping deleted_at.
func (r *OrganizationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE organizations
		SET deleted_at = now(), updated_at = now()
		WHERE id = $1 AND deleted_at IS NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization")
}

// Restore clears deleted_at on a soft-deleted organization, returning
// ErrNotFound when the row is absent or not trashed.
func (r *OrganizationRepository) Restore(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `
		UPDATE organizations
		SET deleted_at = NULL, updated_at = now()
		WHERE id = $1 AND deleted_at IS NOT NULL`,
		id,
	)
	if err != nil {
		return err
	}
	return requireAffected(res, "organization")
}

// ForceDelete permanently removes the row, whether or not it is trashed.
// Members and the LLM provider go with it; email accounts block it, and
// that FK violation surfaces as a conflict.
func (r *OrganizationRepository) ForceDelete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM organizations WHERE id = $1`, id)
	if err != nil {
		return translateForeignKey(err, "organization is still referenced by other records")
	}
	return requireAffected(res, "organization")
}

// FirstOwnerID returns the first owner member of the organization, for
// attributing background AI usage (classify, auto-draft) to a user's quota.
func (r *OrganizationRepository) FirstOwnerID(ctx context.Context, organizationID uuid.UUID) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.queryRowContext(ctx, `
		SELECT user_id FROM organization_members
		WHERE organization_id = $1 AND role = $2
		ORDER BY created_at LIMIT 1`,
		organizationID, constant.MemberRoleOwner,
	).Scan(&id)
	return id, translateNotFound("organizations", err)
}
