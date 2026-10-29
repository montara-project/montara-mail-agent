import type { ISO8601DateString } from '@/types/time'

/** Who made a block: a super user, or the server after repeated failures. */
export type IPBlockSource = 'manual' | 'auto'

/**
 * An address or range the whole server refuses. Mirrors the server's IPBlock
 * (apps/server internal/models/ip_block.go).
 */
export interface IPBlock {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  /** A CIDR range; one address shows as /32 (IPv4) or /128 (IPv6). */
  network: string
  source: IPBlockSource
  reason: string
  /** null blocks until someone removes it. */
  expires_at: ISO8601DateString | null
  created_by: string | null
  created_by_email: string | null
}
