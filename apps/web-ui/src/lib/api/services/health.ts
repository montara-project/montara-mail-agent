import type { HealthResources } from './types/health'

import { api } from '../client-fetch'

const path = '/api/health'

const resources = (): HealthResources => ({
  get: () => api.get(path),
})

export const healthServices = resources()
