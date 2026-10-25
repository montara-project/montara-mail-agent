import type { ActivityLogResources } from './types/activity-log'

import { api } from '../client-fetch'

const path = '/api/v1/me/activity-logs'
const organizationPath = (organizationId: string) =>
  `/api/v1/organizations/${organizationId}/activity-logs`

const resources = (): ActivityLogResources => ({
  mine: (params) => api.get(path, { params }),
  byOrganization: (organizationId, params) => api.get(organizationPath(organizationId), { params }),
})

export const activityLogServices = resources()
