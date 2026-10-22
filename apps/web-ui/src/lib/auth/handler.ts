import { redirect } from '@tanstack/react-router'

import type { AuthSession } from '@/types/auth'

import { queries } from '../api/queries'
import { getQueryClient } from '../providers/react-query'
import { getStoredAccessToken, getStoredRefreshToken } from './token-storage'

/**
 * Read the session issued by our own backend.
 *
 * Tokens live in cookies (see `token-storage.ts`). The user comes from the
 * shared profile query, so the route guard and the sidebar ask the API once.
 */
async function getBackendSession(): Promise<AuthSession | null> {
  const accessToken = getStoredAccessToken()
  const refreshToken = getStoredRefreshToken()

  // The access-token cookie expires with the token; a refresh token alone is
  // still a session, since the axios interceptor trades it on the first 401.
  if (!accessToken && !refreshToken) {
    return null
  }

  try {
    // The profile query returns the API envelope, like every other query.
    const profile = await getQueryClient().ensureQueryData(queries.auth.profile())
    // Read again: the request above may have rotated the tokens.
    const token = getStoredAccessToken() ?? ''

    return {
      user: profile.data,
      session: { token },
      data: {
        accessToken: token,
        refreshToken: getStoredRefreshToken() ?? undefined,
        provider: 'custom' as const,
      },
    }
  } catch {
    return null
  }
}

/**
 * Require authentication and redirect to sign-in if not authenticated.
 */
export async function requireSession(): Promise<AuthSession> {
  const session = await getBackendSession()

  if (!session) {
    throw redirect({ to: '/sign-in', replace: true })
  }

  return session
}

/**
 * Get current session.
 * @returns Session object or null if not authenticated.
 */
export async function getSession(): Promise<AuthSession | null> {
  return getBackendSession()
}

/**
 * Redirect to `href` if the user is already authenticated.
 */
export async function redirectIfAuthenticated(href: string) {
  const session = await getBackendSession()

  if (session) {
    throw redirect({ to: href })
  }
}
