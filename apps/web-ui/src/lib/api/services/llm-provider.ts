import type { LLMProviderResources, LLMProviderScope } from './types/llm-provider'

import { api } from '../client-fetch'

/** The scope select's sentinel values: null is global, 'platform' the
 * platform-user one, an organization id the rest. */
export const PLATFORM_SCOPE = 'platform'

const path = (scope: LLMProviderScope) =>
  scope === 'platform'
    ? '/api/v1/llm-providers/platform-user'
    : scope
      ? `/api/v1/organizations/${scope}/llm-provider`
      : '/api/v1/llm-providers/global'

const resources = (): LLMProviderResources => ({
  list: () => api.get('/api/v1/llm-providers'),
  save: (scope, body) => api.put(path(scope), body),
  delete: (scope) => api.delete(path(scope)),
  models: (scope, body) => api.post(`${path(scope)}/models`, body),
  setScope: (id, scope) =>
    api.put(`/api/v1/llm-providers/${id}/scope`, {
      organization_id: scope && scope !== 'platform' ? scope : '',
      platform_user: scope === 'platform',
    }),
})

export const llmProviderServices = resources()
