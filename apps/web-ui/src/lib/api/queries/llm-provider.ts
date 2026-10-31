import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type {
  LLMModelsBody,
  LLMProviderBody,
  LLMProviderScope,
} from '../services/types/llm-provider'

import { services } from '../services'

const LLM_PROVIDER_QUERY_KEY = 'llm-provider'

/** Every provider the user can see, and what they may do with the platform one. */
const list = () =>
  queryOptions({
    queryKey: [LLM_PROVIDER_QUERY_KEY, 'list'],
    queryFn: async () => {
      const res = await services.llmProvider.list()
      return res.data
    },
  })

const invalidate = () => getQueryClient().invalidateQueries({ queryKey: [LLM_PROVIDER_QUERY_KEY] })

const save = (scope: LLMProviderScope) =>
  mutationOptions({
    mutationFn: async (body: LLMProviderBody) => {
      const res = await services.llmProvider.save(scope, body)
      return res.data.data
    },
    onSuccess: invalidate,
  })

const del = () =>
  mutationOptions({
    mutationFn: async (scope: LLMProviderScope) => {
      const res = await services.llmProvider.delete(scope)
      return res.data
    },
    onSuccess: invalidate,
  })

/** Moves a provider to an organization, or to the platform with null. */
const setScope = () =>
  mutationOptions({
    mutationFn: async ({ id, scope }: { id: string; scope: LLMProviderScope }) => {
      const res = await services.llmProvider.setScope(id, scope)
      return res.data.data
    },
    onSuccess: invalidate,
  })

/** The models a provider offers; cached per scope, kind, base URL and key. */
const models = (scope: LLMProviderScope, body: LLMModelsBody, enabled: boolean) =>
  queryOptions({
    queryKey: [LLM_PROVIDER_QUERY_KEY, scope, 'models', body],
    queryFn: async () => {
      const res = await services.llmProvider.models(scope, body)
      return res.data.data
    },
    enabled,
    // A wrong URL or key will not fix itself; the form offers a retry.
    retry: false,
    staleTime: 5 * 60_000,
  })

export const llmProviderQueries = { list, save, delete: del, setScope, models } as const
