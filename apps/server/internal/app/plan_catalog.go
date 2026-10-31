package app

import (
	"context"
	"sync"

	"montara-mail-agent/server/internal/lib/constant"
	"montara-mail-agent/server/internal/models"
)

// planCatalog caches the plans table for the enforcement hot paths: the
// weekly quota check runs on every AI call, and the caps on every mailbox
// and organization creation. Reloaded at boot and by the daily billing
// sweep, so a plan edited in SQL shows up at the next sweep or restart.
type planCatalog struct {
	mu     sync.RWMutex
	byTier map[string]models.Plan
}

// tierCodes maps a users.plan tier to the plans.code rows that carry its
// limits. Pro reads pro_monthly and falls back to pro_yearly: the two rows
// carry identical limits.
var tierCodes = map[string][]string{
	constant.PlanFree:       {"free"},
	constant.PlanPro:        {"pro_monthly", "pro_yearly"},
	constant.PlanEnterprise: {"enterprise"},
}

// ReloadPlans pulls the plans table into the in-memory catalog. A missing
// tier stays out of the map, which reads as unlimited everywhere (fail open):
// a database without the seeded rows enforces nothing, like limit <= 0.
func (a *Application) ReloadPlans(ctx context.Context) error {
	plans, err := a.Repositories.Plan.All(ctx)
	if err != nil {
		return err
	}
	next := make(map[string]models.Plan, len(tierCodes))
	for tier, codes := range tierCodes {
		for _, code := range codes {
			for _, p := range plans {
				if p.Code == code {
					next[tier] = p
					break
				}
			}
		}
	}
	a.plans.mu.Lock()
	a.plans.byTier = next
	a.plans.mu.Unlock()
	return nil
}

// PlanForTier returns the cached plan row that carries a tier's limits; false
// when the tier is unknown or unseeded, which reads as unlimited.
func (a *Application) PlanForTier(tier string) (models.Plan, bool) {
	a.plans.mu.RLock()
	defer a.plans.mu.RUnlock()
	p, ok := a.plans.byTier[tier]
	return p, ok
}

// WeeklyTokenLimit returns the tier's weekly token allowance, nil when
// unlimited (unknown tier, unseeded catalog, or NULL weekly_tokens).
func (a *Application) WeeklyTokenLimit(tier string) *int64 {
	p, ok := a.PlanForTier(tier)
	if !ok || p.WeeklyTokens == nil {
		return nil
	}
	limit := *p.WeeklyTokens
	return &limit
}
