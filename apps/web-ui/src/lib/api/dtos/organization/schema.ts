import z from 'zod'

import { requiredString } from '@/lib/validation'

export const OrganizationFormSchema = z.object({
  name: requiredString('name'),
})

export type OrganizationFormDto = z.infer<typeof OrganizationFormSchema>
