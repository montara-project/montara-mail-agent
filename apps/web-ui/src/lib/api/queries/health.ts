import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const HEALTH_QUERY_KEY = 'health'

const get = () =>
  queryOptions({
    queryKey: [HEALTH_QUERY_KEY],
    queryFn: async () => {
      const res = await services.health.get()
      return res.data
    },
    refetchInterval: 30_000,
  })

export const healthQueries = {
  get,
} as const
