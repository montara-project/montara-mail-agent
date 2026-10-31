import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import { services } from '../services'

const QUOTA_QUERY_KEY = 'quota'

const status = () =>
  queryOptions({
    queryKey: [QUOTA_QUERY_KEY],
    queryFn: async () => {
      const res = await services.quota.status()
      return res.data.data
    },
  })

const topups = () =>
  queryOptions({
    queryKey: [QUOTA_QUERY_KEY, 'topups'],
    queryFn: async () => {
      const res = await services.quota.listTopups()
      return res.data.data
    },
  })

const createTopup = () => {
  const qc = getQueryClient()
  return mutationOptions({
    mutationFn: async () => {
      const res = await services.quota.createTopup()
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUOTA_QUERY_KEY] }),
  })
}

export const quotaQueries = { status, topups, createTopup } as const
