import z from 'zod'

import { requiredString } from '@/lib/validation'

import { allEmails, MAX_RECIPIENTS, parseRecipients } from '../recipients'

export const ForwardFormSchema = z.object({
  to: requiredString('recipients').refine((value) => {
    const recipients = parseRecipients(value)
    return recipients.length <= MAX_RECIPIENTS && allEmails(recipients)
  }, `Enter up to ${MAX_RECIPIENTS} email addresses, separated by commas.`),
  note: z.string(),
})

export type ForwardFormDto = z.infer<typeof ForwardFormSchema>
