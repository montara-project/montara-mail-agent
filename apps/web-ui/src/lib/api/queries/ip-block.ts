import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { IPBlockBody } from '../services/types/ip-block'

import { services } from '../services'

const IP_BLOCK_QUERY_KEY = 'ip-blocks'

const invalidate = () => getQueryClient().invalidateQueries({ queryKey: [IP_BLOCK_QUERY_KEY] })

/** The blocks in force, and the automatic rule. Automatic ones appear on their own. */
const list = () =>
  queryOptions({
    queryKey: [IP_BLOCK_QUERY_KEY, 'list'],
    queryFn: async () => {
      const res = await services.ipBlocks.list()
      return res.data
    },
    refetchInterval: 30_000,
  })

const create = () =>
  mutationOptions({
    mutationFn: async (body: IPBlockBody) => {
      const res = await services.ipBlocks.store(body)
      return res.data.data
    },
    onSuccess: invalidate,
  })

const del = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.ipBlocks.delete(id)
      return res.data
    },
    onSuccess: invalidate,
  })

export const ipBlockQueries = { list, create, delete: del } as const
