import z from 'zod'

import { requiredString } from '@/lib/validation'

export const SignInSchema = z.object({
  email: requiredString('email').email('The email must be a valid address.'),
  password: requiredString('password'),
})

export type SignInDto = z.infer<typeof SignInSchema>
