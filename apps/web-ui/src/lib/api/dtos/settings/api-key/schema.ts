import z from 'zod'

import { requiredString } from '@/lib/validation'

/** The lifetimes the form offers; the server takes 1 to 365 days. */
export const API_KEY_LIFETIMES = ['30', '90', '180', '365'] as const

export const APIKeySchema = z.object({
  name: requiredString('name').max(100, 'The name must be at most 100 characters.'),
  expires_in_days: z.enum(API_KEY_LIFETIMES),
})

export type APIKeyDto = z.infer<typeof APIKeySchema>
