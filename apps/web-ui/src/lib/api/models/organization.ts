import type { ISO8601DateString } from '@/types/time'

export interface Organization {
  id: string
  name: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  deleted_at?: ISO8601DateString | null
}

/** Dashboard totals of one organization. */
export interface OrganizationStats {
  unread: number
  spam: number
  accounts: number
}
