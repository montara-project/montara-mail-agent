import type { MailResources } from './types/mail'

import { api } from '../client-fetch'
import { withAttachments } from '../dtos/mail/attachments'

const path = '/api/v1/mails'

const resources = (): MailResources => ({
  get: (id) => api.get(`${path}/${id}`),
  patch: (id, body) => api.patch(`${path}/${id}`, body),
  summary: (id) => api.post(`${path}/${id}/summary`),
  replySuggestions: (id, agentBotId) =>
    api.post(
      `${path}/${id}/reply-suggestions`,
      agentBotId ? { agent_bot_id: agentBotId } : undefined
    ),
  draftReply: (id, body) => api.post(`${path}/${id}/draft-reply`, body),
  move: (id, folder) => api.post(`${path}/${id}/move`, { folder }),
  delete: (id) => api.delete(`${path}/${id}`),
  forward: (id, body) => api.post(`${path}/${id}/forward`, body),
  reply: (id, { attachments, ...body }) =>
    api.post(`${path}/${id}/reply`, withAttachments(body, attachments)),
})

export const mailServices = resources()
