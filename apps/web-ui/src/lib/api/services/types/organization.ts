import type { HTTP_METHOD, Resources } from '@/types/api'

import type { Models } from '../../models'

/**
 * The methods `organizationServices` actually builds. Declaring them keeps the
 * type honest: `resource()` only creates the methods it was given, so listing
 * more here (for example `edit`, which the service does not request) would
 * typecheck and then fail at runtime.
 */
export type OrganizationMethods = [
  HTTP_METHOD.GET,
  HTTP_METHOD.POST,
  HTTP_METHOD.PUT,
  HTTP_METHOD.DELETE,
]

export type OrganizationResources = Resources<OrganizationMethods, Models.Organization>
