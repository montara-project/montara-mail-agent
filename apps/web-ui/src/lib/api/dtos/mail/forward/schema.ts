import z from 'zod'

import { requiredString } from '@/lib/validation'

/** The API's cap on recipients of one forward. */
const MAX_RECIPIENTS = 20
const EMAIL = /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/

/** Addresses typed into one box, separated by commas, semicolons or spaces. */
export function parseRecipients(value: string) {
  return value.split(/[\s,;]+/).filter(Boolean)
}

export const ForwardFormSchema = z.object({
  to: requiredString('recipients').refine((value) => {
    const recipients = parseRecipients(value)
    return recipients.length <= MAX_RECIPIENTS && recipients.every((r) => EMAIL.test(r))
  }, `Enter up to ${MAX_RECIPIENTS} email addresses, separated by commas.`),
  note: z.string(),
})

export type ForwardFormDto = z.infer<typeof ForwardFormSchema>
