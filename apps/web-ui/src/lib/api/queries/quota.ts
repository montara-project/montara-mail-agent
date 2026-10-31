import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

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

/** One page of the top-up history; the last page stays while the next loads. */
const topups = (params: { offset: number; limit: number }) =>
  queryOptions({
    queryKey: [QUOTA_QUERY_KEY, 'topups', params],
    queryFn: async () => {
      const res = await services.quota.listTopups(params)
      return res.data
    },
    placeholderData: keepPreviousData,
  })

const topup = (id: string) =>
  queryOptions({
    queryKey: [QUOTA_QUERY_KEY, 'topups', id],
    queryFn: async () => {
      const res = await services.quota.topup(id)
      return res.data.data
    },
    // A 404 won't change: show "not found" now, not after the retries.
    retry: (failures, error) =>
      !(isAxiosError(error) && error.response?.status === 404) && failures < 3,
    // The webhook credits a payment seconds after the customer lands back here.
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
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

export const quotaQueries = { status, topups, topup, createTopup } as const
