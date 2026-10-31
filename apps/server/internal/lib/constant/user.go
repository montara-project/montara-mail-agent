package constant

// User roles stored in users.role (see migration 000003).
const (
	RoleUser      = "user"
	RoleSuperUser = "super_user"
)

// The billing plan a user is on (users.plan): free, or one of the paid
// tiers the plans table prices. A pro user carries the larger weekly token
// allowance and no mailbox cap; enterprise is configured per contract.
const (
	PlanFree       = "free"
	PlanPro        = "pro"
	PlanEnterprise = "enterprise"
)
