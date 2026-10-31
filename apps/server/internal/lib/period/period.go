// Package period computes the bucket a moment falls in, so a quota week and
// the dashboard agree on the window. Weeks start Monday, UTC.
package period

import "time"

// WeekStart returns the Monday 00:00 UTC that t falls in.
func WeekStart(t time.Time) time.Time {
	t = t.UTC()
	// Go's weekday: Sunday=0 ... Saturday=6. Monday-based offset:
	offset := (int(t.Weekday()) + 6) % 7
	return time.Date(t.Year(), t.Month(), t.Day()-offset, 0, 0, 0, 0, time.UTC)
}
