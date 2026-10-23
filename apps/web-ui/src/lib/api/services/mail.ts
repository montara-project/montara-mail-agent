import type { MailResources } from './types/mail'

import { api } from '../client-fetch'

const path = '/api/v1/mails'

const resources = (): MailResources => ({
  get: (id) => api.get(`${path}/${id}`),
  patch: (id, body) => api.patch(`${path}/${id}`, body),
  summary: (id) => api.post(`${path}/${id}/summary`),
  replySuggestions: (id) => api.post(`${path}/${id}/reply-suggestions`),
  move: (id, folder) => api.post(`${path}/${id}/move`, { folder }),
  delete: (id) => api.delete(`${path}/${id}`),
  forward: (id, body) => api.post(`${path}/${id}/forward`, body),
  reply: (id, body) => api.post(`${path}/${id}/reply`, body),
})

export const mailServices = resources()
