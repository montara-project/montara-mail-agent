import type { AgentBotResources } from './types/agent-bot'

import { api } from '../client-fetch'

const organizationPath = (orgId: string) => `/api/v1/organizations/${orgId}/agent-bots`
const path = '/api/v1/agent-bots'

const resources = (): AgentBotResources => ({
  list: (orgId) => api.get(organizationPath(orgId)),
  get: (id) => api.get(`${path}/${id}`),
  store: (orgId, body) => api.post(organizationPath(orgId), body),
  update: (id, body) => api.put(`${path}/${id}`, body),
  delete: (id) => api.delete(`${path}/${id}`),
})

export const agentBotServices = resources()
