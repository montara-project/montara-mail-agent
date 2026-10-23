package constant

// Id of the default organization the seeder always creates.
const OrganizationPersonalID = "01a1247c-269d-7096-b1e2-649ed0395555"

// Organization member roles (see migration 000004). The owner created it
// and alone may rename or delete it.
const (
	MemberRoleOwner  = "owner"
	MemberRoleMember = "member"
)
