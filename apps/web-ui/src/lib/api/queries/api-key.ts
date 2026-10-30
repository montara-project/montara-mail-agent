import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { APIKeyBody } from '../services/types/api-key'

import { services } from '../services'

const API_KEY_QUERY_KEY = 'api-keys'

const invalidate = () => getQueryClient().invalidateQueries({ queryKey: [API_KEY_QUERY_KEY] })

/** The user's keys, newest first. */
const list = () =>
  queryOptions({
    queryKey: [API_KEY_QUERY_KEY, 'list'],
    queryFn: async () => {
      const res = await services.apiKeys.list()
      return res.data.data
    },
  })

const create = () =>
  mutationOptions({
    mutationFn: async (body: APIKeyBody) => {
      const res = await services.apiKeys.store(body)
      return res.data.data
    },
    onSuccess: invalidate,
  })

const del = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.apiKeys.delete(id)
      return res.data
    },
    onSuccess: invalidate,
  })

export const apiKeyQueries = { list, create, delete: del } as const
