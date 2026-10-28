import z from 'zod'

import { requiredString } from '@/lib/validation'

// The same bounds as the server and Authula's sign-up.
const MIN_PASSWORD = 8
const MAX_PASSWORD = 128

export const UpdateProfileSchema = z.object({
  name: requiredString('name').max(100, 'The name must be at most 100 characters.'),
  // Empty removes the avatar.
  image: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^https:\/\/\S+$/.test(value),
      'The avatar must be an https:// URL.'
    ),
  // An IANA zone from the picker; the server checks it too.
  timezone: requiredString('timezone'),
})

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>

export const UpdatePasswordSchema = z
  .object({
    current_password: requiredString('current password'),
    new_password: z
      .string()
      .min(MIN_PASSWORD, `The new password must be at least ${MIN_PASSWORD} characters.`)
      .max(MAX_PASSWORD, `The new password must be at most ${MAX_PASSWORD} characters.`),
    confirm_password: z.string(),
  })
  .refine((value) => value.confirm_password === value.new_password, {
    message: 'The passwords do not match.',
    path: ['confirm_password'],
  })

export type UpdatePasswordDto = z.infer<typeof UpdatePasswordSchema>
