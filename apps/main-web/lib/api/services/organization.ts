import { HTTP_METHOD } from '@/types/api'

import type { OrganizationMethods, OrganizationResources } from './types/organization'

import { clientResource } from '../resource'

const path = '/api/v1/organizations'

// Typed by OrganizationMethods so the runtime methods and the declared type
// cannot drift apart.
const methods: OrganizationMethods = [
  HTTP_METHOD.GET,
  HTTP_METHOD.POST,
  HTTP_METHOD.PUT,
  HTTP_METHOD.DELETE,
]

const resources = (): OrganizationResources => {
  return {
    ...clientResource(path, methods),
  }
}

export const organizationServices = resources()
