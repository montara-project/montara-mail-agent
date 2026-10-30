package handlers

import (
	"errors"
	"strings"
	"testing"

	"montara-mail-agent/server/internal/models"
)

func TestForEachAccount(t *testing.T) {
	groups := []bulkGroup{
		{mails: make([]models.Mail, 2)},
		{mails: make([]models.Mail, 3)},
		{mails: make([]models.Mail, 4)},
	}
	failAt := func(bad ...int) (*int, func(bulkGroup) error) {
		ran := 0
		return &ran, func(bulkGroup) error {
			i := ran
			ran++
			for _, b := range bad {
				if i == b {
					return errors.New("refused")
				}
			}
			return nil
		}
	}

	ran, run := failAt()
	if err := forEachAccount(groups, 9, "moved", run); err != nil || *ran != 3 {
		t.Fatalf("all fine: %v, ran %d", err, *ran)
	}

	// A broken account in the middle holds nothing back, and the answer counts.
	ran, run = failAt(1)
	err := forEachAccount(groups, 9, "moved", run)
	if *ran != 3 || err == nil || !strings.Contains(err.Error(), "6 of 9 mails moved") {
		t.Fatalf("one refused: %v, ran %d", err, *ran)
	}

	// Nothing done: the plain refusal, no count.
	_, run = failAt(0, 1, 2)
	err = forEachAccount(groups, 9, "moved", run)
	if err == nil || strings.Contains(err.Error(), "of 9") || !strings.Contains(err.Error(), "refused") {
		t.Fatalf("all refused: %v", err)
	}
}
