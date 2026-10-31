import type { QuotaResources } from './types/quota'

import { api } from '../client-fetch'

const path = '/api/v1/me/quota'

const resources = (): QuotaResources => ({
  status: () => api.get(path),
  listTopups: (params) => api.get(`${path}/topups`, { params }),
  topup: (id: string) => api.get(`${path}/topups/${id}`),
  createTopup: () => api.post(`${path}/topups`, {}),
})

export const quotaServices = resources()
