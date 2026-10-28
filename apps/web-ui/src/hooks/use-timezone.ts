import { useQuery } from '@tanstack/react-query'

import { queries } from '@/lib/api/queries'
import { DEFAULT_TIMEZONE } from '@/lib/constants/timezones'

/** The signed-in user's timezone (My Profile), UTC until they pick one. */
export function useTimezone() {
  const { data } = useQuery(queries.auth.profile())
  return data?.user.metadata?.timezone ?? DEFAULT_TIMEZONE
}
