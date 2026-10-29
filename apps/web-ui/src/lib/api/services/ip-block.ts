import type { IPBlockResources } from './types/ip-block'

import { api } from '../client-fetch'

const path = '/api/v1/ip-blocks'

const resources = (): IPBlockResources => ({
  list: () => api.get(path),
  store: (body) => api.post(path, body),
  delete: (id) => api.delete(`${path}/${id}`),
})

export const ipBlockServices = resources()
