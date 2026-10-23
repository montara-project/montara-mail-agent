import { HTTP_METHOD } from '@/types/api'

import type { Models } from '../models'
import type { OrganizationMethods, OrganizationResources } from './types/organization'

import { api } from '../client-fetch'
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
    ...clientResource<typeof path, OrganizationMethods, Models.Organization>(path, methods),
    stats: (id) => api.get(`${path}/${id}/stats`),
  }
}

export const organizationServices = resources()
