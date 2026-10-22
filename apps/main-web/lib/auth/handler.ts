import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { AUTH_STORAGE_KEYS } from '../constants/auth'

/**
 * Server-side session check for layouts and pages.
 *
 * Tokens live in cookies (see `token-storage.ts`). The access-token cookie
 * expires with the token; a refresh token alone is still a session, since the
 * axios interceptor trades it on the first 401 and sends the browser to
 * sign-in when that fails too.
 */
async function hasSession() {
  const store = await cookies()
  return store.has(AUTH_STORAGE_KEYS.ACCESS_TOKEN) || store.has(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
}

/**
 * Require authentication and redirect to sign-in if not authenticated.
 */
export async function requireSession() {
  if (!(await hasSession())) {
    redirect('/sign-in')
  }
}

/**
 * Redirect to `href` if the user is already authenticated.
 */
export async function redirectIfAuthenticated(href: string) {
  if (await hasSession()) {
    redirect(href)
  }
}
