package repositories

import "database/sql"

type Repositories struct {
	Organization OrganizationRepository
	User         UserRepository
}

// New builds every repository over db.
func New(db *sql.DB) Repositories {
	base := BaseRepository{DB: db}

	return Repositories{
		Organization: OrganizationRepository{base},
		User:         UserRepository{base},
	}
}
