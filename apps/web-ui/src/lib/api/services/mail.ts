import type { MailResources } from './types/mail'

import { api } from '../client-fetch'

const path = '/api/v1/mails'

const resources = (): MailResources => ({
  get: (id) => api.get(`${path}/${id}`),
  patch: (id, body) => api.patch(`${path}/${id}`, body),
  summary: (id) => api.post(`${path}/${id}/summary`),
  replySuggestions: (id) => api.post(`${path}/${id}/reply-suggestions`),
})

export const mailServices = resources()
