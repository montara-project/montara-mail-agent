import type { LLMProviderResources } from './types/llm-provider'

import { api } from '../client-fetch'

const path = (organizationId: string) => `/api/v1/organizations/${organizationId}/llm-provider`

const resources = (): LLMProviderResources => ({
  get: (organizationId) => api.get(path(organizationId)),
  save: (organizationId, body) => api.put(path(organizationId), body),
  delete: (organizationId) => api.delete(path(organizationId)),
  models: (organizationId, body) => api.post(`${path(organizationId)}/models`, body),
})

export const llmProviderServices = resources()
