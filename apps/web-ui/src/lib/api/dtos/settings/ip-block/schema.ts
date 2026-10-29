import z from 'zod'

import { requiredString } from '@/lib/validation'

/** How long a manual block lasts, in hours; '0' is until removed. */
export const IP_BLOCK_DURATIONS = ['1', '24', '168', '720', '0'] as const

export const IPBlockSchema = z.object({
  address: requiredString('address').max(64, 'The address must be at most 64 characters.'),
  reason: z.string().max(300, 'The reason must be at most 300 characters.'),
  expires_in_hours: z.enum(IP_BLOCK_DURATIONS),
})

export type IPBlockDto = z.infer<typeof IPBlockSchema>
