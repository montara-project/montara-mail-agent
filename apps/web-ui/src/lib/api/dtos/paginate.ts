import z from 'zod'

import { optionalNumber } from '@/lib/validation'

/**
 * Shared pagination query for list endpoints. The Go API binds `offset`
 * (0-based) and `limit` (default 10, capped at 100).
 */
const PaginateSchema = z.object({
  offset: optionalNumber('offset'),
  limit: optionalNumber('limit'),
})

export type PaginateDto = z.infer<typeof PaginateSchema>
