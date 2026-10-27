import type { AgentSkillResources } from './types/agent-skill'

import { api } from '../client-fetch'

const organizationPath = (orgId: string) => `/api/v1/organizations/${orgId}/skills`
const path = '/api/v1/skills'

const resources = (): AgentSkillResources => ({
  list: (orgId) => api.get(organizationPath(orgId)),
  store: (orgId, body) => api.post(organizationPath(orgId), body),
  update: (id, body) => api.put(`${path}/${id}`, body),
  delete: (id) => api.delete(`${path}/${id}`),
  setBuiltin: (orgId, key, body) => api.put(`${organizationPath(orgId)}/builtin/${key}`, body),
})

export const agentSkillServices = resources()
