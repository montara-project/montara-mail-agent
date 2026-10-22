package models

type Organization struct {
	Base
	SoftDelete
	Name string `db:"name" json:"name"`
}
