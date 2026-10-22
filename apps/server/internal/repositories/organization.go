package repositories

import (
	"context"
	"fmt"

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

// Insert persists a new organization.
func (r *OrganizationRepository) Insert(ctx context.Context, c models.Organization) error {
	_, err := r.execContext(ctx, `
		INSERT INTO organizations (id, name)
		VALUES ($1, $2)`,
		c.ID, c.Name,
	)
	return err
}

// organizationSortColumns whitelists the columns a `sorted` value may order by.
var organizationSortColumns = map[string]string{
	"name":       "name",
	"created_at": "created_at",
	"updated_at": "updated_at",
}

// organizationFilters builds the WHERE conditions shared by List and Count.
func organizationFilters(p ListParams) *whereBuilder {
	w := newWhere(`deleted_at IS NULL`)
	w.search(p.Search, "name")
	return w
}

// List returns one page of live organizations, optionally filtered by a
// case-insensitive name search and ordered by p.Sorted. Callers clamp the
// offset/limit first (see dtos.ListQuery.Clamp).
func (r *OrganizationRepository) List(ctx context.Context, p ListParams) ([]models.Organization, error) {
	where, args, limit, offset := organizationFilters(p).page(p)

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

// Count returns how many live organizations match the List filters, for the
// response meta block.
func (r *OrganizationRepository) Count(ctx context.Context, p ListParams) (int64, error) {
	return r.countRows(ctx, "organizations", organizationFilters(p))
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
// FK violations from referencing tables surface as a conflict.
func (r *OrganizationRepository) ForceDelete(ctx context.Context, id uuid.UUID) error {
	res, err := r.execContext(ctx, `DELETE FROM organizations WHERE id = $1`, id)
	if err != nil {
		return translateForeignKey(err, "organization is still referenced by other records")
	}
	return requireAffected(res, "organization")
}
