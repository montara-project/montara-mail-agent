import type { OrganizationResources } from './types/organization'

import { api } from '../client-fetch'

const path = '/api/v1/organizations'

const resources = (): OrganizationResources => ({
  list: (params) => api.get(path, { params }),
  get: (id) => api.get(`${path}/${id}`),
  store: (body) => api.post(path, body),
  update: (id, body) => api.put(`${path}/${id}`, body),
  delete: (id) => api.delete(`${path}/${id}`),
  stats: (id) => api.get(`${path}/${id}/stats`),
  mails: (id, params) => api.get(`${path}/${id}/mails`, { params }),
})

export const organizationServices = resources()
