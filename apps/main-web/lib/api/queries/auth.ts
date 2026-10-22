import { queryOptions } from '@tanstack/react-query'

import { services } from '../services'

export const PROFILE_QUERY_KEY = 'profile'

/** The signed-in user's profile, with its role embedded. */
const profile = () =>
  queryOptions({
    queryKey: [PROFILE_QUERY_KEY],
    // A 401 means "not signed in"; retrying only delays the redirect.
    retry: false,
    queryFn: async () => {
      const res = await services.auth.me()
      return res.data
    },
  })

export const authQueries = {
  profile,
} as const
