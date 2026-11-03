import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { services } from '../services'

const ACTIVITY_LOG_QUERY_KEY = 'activity-logs'

/** How many entries one page of the log holds. */
export const ACTIVITY_LOG_PAGE_SIZE = 10

/** One page of a log: the user's own, or an organization's. The last page stays
 * on screen while the next one loads, so the pagination doesn't jump. */
const page = (pageIndex: number, organizationId?: string) =>
  queryOptions({
    queryKey: [ACTIVITY_LOG_QUERY_KEY, organizationId ?? 'me', pageIndex],
    queryFn: async () => {
      const params = { offset: pageIndex * ACTIVITY_LOG_PAGE_SIZE, limit: ACTIVITY_LOG_PAGE_SIZE }
      const res = organizationId
        ? await services.activityLog.byOrganization(organizationId, params)
        : await services.activityLog.mine(params)
      return res.data
    },
    placeholderData: keepPreviousData,
  })

export const activityLogQueries = {
  page,
} as const
