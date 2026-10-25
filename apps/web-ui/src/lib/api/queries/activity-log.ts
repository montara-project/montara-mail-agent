import { infiniteQueryOptions } from '@tanstack/react-query'

import { services } from '../services'

const ACTIVITY_LOG_QUERY_KEY = 'activity-logs'

/** How many entries one page of the log holds. */
export const ACTIVITY_LOG_PAGE_SIZE = 10

/** One log's activities — the user's own, or an organization's — one page at
 * a time for a "Load more" list. */
const infinite = (organizationId?: string) =>
  infiniteQueryOptions({
    queryKey: [ACTIVITY_LOG_QUERY_KEY, organizationId ?? 'me', 'infinite'],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      const page = { offset: pageParam, limit: ACTIVITY_LOG_PAGE_SIZE }
      const res = organizationId
        ? await services.activityLog.byOrganization(organizationId, page)
        : await services.activityLog.mine(page)
      return res.data
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const total = lastPage.metadata.total ?? 0
      const nextOffset = allPages.length * ACTIVITY_LOG_PAGE_SIZE
      return nextOffset < total ? nextOffset : undefined
    },
  })

export const activityLogQueries = {
  infinite,
} as const
