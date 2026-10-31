package constant

// User roles stored in users.role (see migration 000003).
const (
	RoleUser      = "user"
	RoleSuperUser = "super_user"
)

// The billing plan a user is on (users.plan): free or subscribed. A
// subscribed user carries the larger weekly token allowance and no mailbox
// cap, and the app shows their allowance as Unlimited.
const (
	PlanFree       = "free"
	PlanSubscribed = "subscribed"
)
