import type { ProfileResources } from './types/profile'

import { api } from '../client-fetch'

const path = '/api/v1/me'

const resources = (): ProfileResources => ({
  security: () => api.get(`${path}/security`),
  update: (body) => api.patch(path, body),
  changePassword: (body) => api.put(`${path}/password`, body),
})

export const profileServices = resources()
