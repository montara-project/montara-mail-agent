import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { LLMProviderBody } from '../services/types/llm-provider'

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

export const llmProviderQueries = { get, save, delete: del } as const
