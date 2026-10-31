import type { EmailAccountResources } from './types/email-account'

import { api } from '../client-fetch'
import { withAttachments } from '../dtos/mail/attachments'

const organizationPath = (organizationId: string) =>
  `/api/v1/organizations/${organizationId}/email-accounts`
const path = '/api/v1/email-accounts'

const resources = (): EmailAccountResources => ({
  list: (organizationId) => api.get(organizationPath(organizationId)),
  create: (organizationId, body) => api.post(organizationPath(organizationId), body),
  delete: (id) => api.delete(`${path}/${id}`),
  transfer: (id, body) => api.post(`${path}/${id}/transfer`, body),
  sync: (id) => api.post(`${path}/${id}/sync`),
  send: (id, { attachments, ...body }) =>
    api.post(`${path}/${id}/send`, withAttachments(body, attachments)),
  mails: (id, params) => api.get(`${path}/${id}/mails`, { params }),
  oauthFinish: (provider, body) => api.post(`${path}/oauth/${provider}/finish`, body),
  oauthConnect: (organizationId, provider) =>
    api.post(`${organizationPath(organizationId)}/oauth/${provider}`),
})

export const emailAccountServices = resources()
