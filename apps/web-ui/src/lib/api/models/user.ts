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

/**
 * A sign-in of a user with two-factor sign-in on: no tokens yet, only a
 * pending cookie for POST /totp/verify.
 */
export interface TOTPRedirect {
  totp_redirect: true
}

/** GET /api/v1/me/security. */
export interface UserSecurity {
  /** False for a user who only signs in with Google or a magic link. */
  has_password: boolean
  totp_enabled: boolean
}

/** POST /api/v1/auth/totp/enable: on once a first code is verified. */
export interface TOTPSetup {
  totp_uri: string
  backup_codes: string[]
}
