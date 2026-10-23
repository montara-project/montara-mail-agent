import type { ISO8601DateString } from '@/types/time'

export type EmailProvider = 'gmail' | 'outlook' | 'yahoo' | 'icloud' | 'imap'

/** A mailbox connected over IMAP; the password never leaves the server. */
export interface EmailAccount {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  organization_id: string
  provider: EmailProvider
  label: string
  email: string
  imap_host: string
  imap_port: number
  username: string
  /** Last successful sync; null until the first one finishes. */
  synced_at: ISO8601DateString | null
  /** Why the last sync failed; null when it succeeded. */
  sync_error: string | null
  /** Unread inbox mail. */
  unread: number
  spam: number
}
