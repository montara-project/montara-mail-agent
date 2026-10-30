import { redirect } from '@tanstack/react-router'

import { queries } from '../api/queries'
import { getQueryClient } from '../providers/react-query'
import { getStoredAccessToken, getStoredRefreshToken } from './token-storage'

/**
 * Whether our own backend still knows this browser.
 *
 * Tokens live in cookies (see `token-storage.ts`). The check loads the shared
 * profile query, so the route guard and the sidebar ask the API once.
 */
async function hasSession(): Promise<boolean> {
  // The access-token cookie expires with the token; a refresh token alone is
  // still a session, since the axios interceptor trades it on the first 401.
  if (!getStoredAccessToken() && !getStoredRefreshToken()) return false

  try {
    await getQueryClient().ensureQueryData(queries.auth.profile())
    return true
  } catch {
    return false
  }
}

/**
 * Require authentication and redirect to sign-in if not authenticated.
 */
export async function requireSession() {
  if (!(await hasSession())) {
    throw redirect({ to: '/sign-in', replace: true })
  }
}

/**
 * Redirect to `href` if the user is already authenticated.
 */
export async function redirectIfAuthenticated(href: string) {
  if (await hasSession()) {
    throw redirect({ to: href })
  }
}
