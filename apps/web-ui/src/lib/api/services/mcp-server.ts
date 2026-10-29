import type { MCPServerResources } from './types/mcp-server'

import { api } from '../client-fetch'

const organizationPath = (orgId: string) => `/api/v1/organizations/${orgId}/mcp-servers`
const path = '/api/v1/mcp-servers'

const resources = (): MCPServerResources => ({
  list: (orgId) => api.get(organizationPath(orgId)),
  store: (orgId, body) => api.post(organizationPath(orgId), body),
  update: (id, body) => api.put(`${path}/${id}`, body),
  delete: (id) => api.delete(`${path}/${id}`),
  testDraft: (orgId, body) => api.post(`${organizationPath(orgId)}/test`, body),
  test: (id) => api.post(`${path}/${id}/test`),
  sync: (id) => api.post(`${path}/${id}/sync`),
  oauthStart: (id) => api.post(`${path}/${id}/oauth/start`),
  oauthFinish: (body) => api.post(`${path}/oauth/finish`, body),
})

export const mcpServerServices = resources()
