import type { ISO8601DateString } from '@/types/time'

import type { Role } from './role'

export interface User {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  deleted_at?: ISO8601DateString | null
  fullname: string
  email: string
  phone: string | null
  address: string | null
  is_active: boolean
  is_blocked: boolean
  role_id: string
  /** Embedded when the request asks for ?include=role. */
  role?: Role
}

/** Session payload returned by POST /api/auth/sign-in and /refresh. */
export interface SignInData {
  uid: string
  display_name: string
  email: string
  access_token: string
  refresh_token: string
  id_token: string
  expires_at: ISO8601DateString
  expires_in: number
  role: string
}
