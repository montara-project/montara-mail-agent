import type { ISO8601DateString } from '@/types/time'

/** Authula user, as returned inside GET /me and the sign-in body. */
export interface User {
  id: string
  name: string
  email: string
  email_verified: boolean
  image: string | null
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
}

/** GET /api/v1/auth/me. Authula answers unwrapped, without the {data} envelope. */
export interface MeData {
  user: User
}

/** POST /api/v1/auth/email-password/sign-in, with the tokens the server adds. */
export interface SignInData extends MeData {
  access_token: string
  refresh_token: string
  expires_at: ISO8601DateString
  expires_in: number
}

/** POST /api/v1/auth/token/refresh. */
export interface RefreshData {
  access_token: string
  refresh_token: string
}
