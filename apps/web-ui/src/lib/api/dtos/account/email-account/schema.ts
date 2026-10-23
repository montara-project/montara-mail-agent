import z from 'zod'

import { requiredString } from '@/lib/validation'

export const EmailAccountFormSchema = z.object({
  email: requiredString('email').regex(/^[^@\s]+@[^@\s]+$/, 'The email must be a valid address.'),
  password: requiredString('app password'),
  // Optional fields stay strings: an empty input is "".
  label: z.string().trim(),
  imap_host: z.string().trim(),
  imap_port: z.string().trim(),
})

/** A custom IMAP account names its server; the known providers have theirs built in. */
export const ImapAccountFormSchema = EmailAccountFormSchema.extend({
  imap_host: requiredString('IMAP server').regex(
    /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/,
    'The IMAP server must be a host name, e.g. imap.example.com.'
  ),
  imap_port: requiredString('port').regex(/^\d{1,5}$/, 'The port must be a number.'),
})

export type EmailAccountFormDto = z.infer<typeof EmailAccountFormSchema>
