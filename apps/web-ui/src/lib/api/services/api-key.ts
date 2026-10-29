import type { APIKeyResources } from './types/api-key'

import { api } from '../client-fetch'

const path = '/api/v1/me/api-keys'

const resources = (): APIKeyResources => ({
  list: () => api.get(path),
  store: (body) => api.post(path, body),
  delete: (id) => api.delete(`${path}/${id}`),
})

export const apiKeyServices = resources()
