import z from 'zod'

import { optionalNumber } from '@/lib/validation'

/**
 * Shared pagination query for list endpoints. The Go API binds `offset`
 * (0-based) and `limit` (default 10, capped at 100).
 */
export const PaginateSchema = z.object({
  offset: optionalNumber('offset'),
  limit: optionalNumber('limit'),
})

/** Relation names a list request may embed, comma-separated (?include=). */
export type IncludeParam = { include?: string }

export type PaginateDto = z.infer<typeof PaginateSchema>
