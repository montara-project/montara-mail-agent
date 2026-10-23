import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { LLMModelsBody, LLMProviderBody } from '../services/types/llm-provider'

import { services } from '../services'

export const LLM_PROVIDER_QUERY_KEY = 'llm-provider'

/** The organization's provider (data null when it has none) and whether a fallback exists. */
const get = (organizationId?: string) =>
  queryOptions({
    queryKey: [LLM_PROVIDER_QUERY_KEY, organizationId],
    queryFn: async () => {
      const res = await services.llmProvider.get(organizationId!)
      return res.data
    },
    enabled: !!organizationId,
  })

const save = (organizationId: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (body: LLMProviderBody) => {
      const res = await services.llmProvider.save(organizationId, body)
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LLM_PROVIDER_QUERY_KEY, organizationId] }),
  })
}

const del = (organizationId: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async () => {
      const res = await services.llmProvider.delete(organizationId)
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [LLM_PROVIDER_QUERY_KEY, organizationId] }),
  })
}

/** The models a provider offers; cached per kind, base URL and key. */
const models = (organizationId: string, body: LLMModelsBody, enabled: boolean) =>
  queryOptions({
    queryKey: [LLM_PROVIDER_QUERY_KEY, organizationId, 'models', body],
    queryFn: async () => {
      const res = await services.llmProvider.models(organizationId, body)
      return res.data.data
    },
    enabled,
    // A wrong URL or key will not fix itself; the form offers a retry.
    retry: false,
    staleTime: 5 * 60_000,
  })

export const llmProviderQueries = { get, save, delete: del, models } as const
