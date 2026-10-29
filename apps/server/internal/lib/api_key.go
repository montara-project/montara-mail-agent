package lib

import (
	apikeyplugintypes "github.com/Authula/authula/plugins/api-key/types"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// APIKeyOrganizationField is the key metadata field that scopes an API key to
// one organization. Authula's update route, which could change metadata, is
// not mounted (cmd/api/api_keys.go), so a key's scope is fixed at creation.
const APIKeyOrganizationField = "organization_id"

// APIKeyReadOnlyField marks a key that may only list, search and read mail.
const APIKeyReadOnlyField = "read_only"

// APIKeyReadOnly reports whether a key may only read.
func APIKeyReadOnly(k *apikeyplugintypes.ApiKey) bool {
	readOnly, _ := k.Metadata[APIKeyReadOnlyField].(bool)
	return readOnly
}

// ContextSetAPIKeyReadOnly stores whether the signed-in key may only read.
func ContextSetAPIKeyReadOnly(c fiber.Ctx, readOnly bool) {
	fiber.Locals[bool](c, "api_key_read_only", readOnly)
}

// ContextGetAPIKeyReadOnly returns what ContextSetAPIKeyReadOnly stored.
func ContextGetAPIKeyReadOnly(c fiber.Ctx) bool {
	return fiber.Locals[bool](c, "api_key_read_only")
}

// APIKeyOrganization returns the organization a key is scoped to, or uuid.Nil
// for a global key.
func APIKeyOrganization(k *apikeyplugintypes.ApiKey) uuid.UUID {
	raw, _ := k.Metadata[APIKeyOrganizationField].(string)
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil
	}
	return id
}

// ContextSetAPIKeyOrganization stores the signed-in key's organization scope
// (uuid.Nil: global) for the /mcp handler.
func ContextSetAPIKeyOrganization(c fiber.Ctx, orgID uuid.UUID) {
	fiber.Locals[uuid.UUID](c, "api_key_org", orgID)
}

// ContextGetAPIKeyOrganization returns what ContextSetAPIKeyOrganization stored,
// uuid.Nil when nothing was.
func ContextGetAPIKeyOrganization(c fiber.Ctx) uuid.UUID {
	return fiber.Locals[uuid.UUID](c, "api_key_org")
}
