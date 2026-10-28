import type { LLMProviderResources, LLMProviderScope } from './types/llm-provider'

import { api } from '../client-fetch'

const path = (scope: LLMProviderScope) =>
  scope ? `/api/v1/organizations/${scope}/llm-provider` : '/api/v1/llm-providers/global'

const resources = (): LLMProviderResources => ({
  list: () => api.get('/api/v1/llm-providers'),
  save: (scope, body) => api.put(path(scope), body),
  delete: (scope) => api.delete(path(scope)),
  models: (scope, body) => api.post(`${path(scope)}/models`, body),
  setScope: (id, scope) =>
    api.put(`/api/v1/llm-providers/${id}/scope`, { organization_id: scope ?? '' }),
})

export const llmProviderServices = resources()
