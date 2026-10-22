import z from 'zod'

import { requiredString } from '@/lib/validation'

export const SignInSchema = z.object({
  email: requiredString('email').email('email must be a valid email address'),
  password: requiredString('password'),
})

export type SignInDto = z.infer<typeof SignInSchema>
