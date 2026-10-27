import type { AgentResources } from './types/agent'

import { api } from '../client-fetch'

const path = '/api/v1/agent'

const resources = (): AgentResources => ({
  conversations: (organizationId) =>
    api.get(`${path}/conversations`, { params: { organization_id: organizationId } }),
  createConversation: (body) => api.post(`${path}/conversations`, body),
  conversation: (id) => api.get(`${path}/conversations/${id}`),
  deleteConversation: (id) => api.delete(`${path}/conversations/${id}`),
  drafts: (organizationId, status) =>
    api.get(`${path}/drafts`, { params: { organization_id: organizationId, status } }),
  approveAction: (id) => api.post(`${path}/actions/${id}/approve`),
  denyAction: (id) => api.post(`${path}/actions/${id}/deny`),
  approveDraft: (id) => api.post(`${path}/drafts/${id}/approve`),
  discardDraft: (id) => api.post(`${path}/drafts/${id}/discard`),
})

export const agentServices = resources()
