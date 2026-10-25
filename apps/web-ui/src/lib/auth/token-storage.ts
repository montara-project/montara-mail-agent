import { AUTH_STORAGE_KEYS } from '../constants/auth'

/**
 * Tokens live in non-HttpOnly cookies on purpose: the UI talks to an API that
 * may sit on another origin (the self-hosted case), where an HttpOnly session
 * cookie cannot carry a Bearer header. The cost is that an XSS in this app
 * could read them; the XSS surface is kept small elsewhere (email HTML runs
 * in a sandboxed frame without scripts, no dangerouslySetInnerHTML in the
 * codebase). For a same-origin hosted deployment the tighter design is a
 * BFF-held refresh cookie; revisit if the hosted edition grows one.
 */

const isBrowser = typeof window !== 'undefined'

// Access/id tokens are short lived; refresh token needs to outlive them.
const DEFAULT_ACCESS_TOKEN_MAX_AGE = 60 * 60 // 1 hour
// Matches the API's refresh-token TTL (apps/server cmd/api refreshTokenTTL):
// the server refuses an older refresh token anyway, so a longer cookie only
// leaves a live-looking token a successful XSS could exfiltrate.
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 // 24 hours

interface AuthTokens {
  accessToken: string
  refreshToken?: string
  idToken?: string
  /** Access token lifetime in seconds, as returned by the backend (`expires_in`). */
  expiresIn?: number
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser) return

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`
}

function readCookie(name: string): string | null {
  if (!isBrowser) return null

  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function removeCookie(name: string) {
  if (!isBrowser) return

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`
}

/**
 * Persist backend-issued auth tokens in cookies. The axios interceptor in
 * `client-fetch.ts` reads the access token from here and sends it as a Bearer
 * header, which is what lets the UI talk to an API on another origin.
 */
export function setAuthTokens({ accessToken, refreshToken, idToken, expiresIn }: AuthTokens) {
  const accessMaxAge = expiresIn ?? DEFAULT_ACCESS_TOKEN_MAX_AGE

  // Access Token
  writeCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN, accessToken, accessMaxAge)

  // Refresh Token
  if (refreshToken) {
    writeCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN, refreshToken, REFRESH_TOKEN_MAX_AGE)
  }

  // ID Token
  if (idToken) {
    writeCookie(AUTH_STORAGE_KEYS.ID_TOKEN, idToken, accessMaxAge)
  }
}

/**
 * Read the backend-issued access token from cookies (client-side).
 */
export function getStoredAccessToken(): string | null {
  return readCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
}

/**
 * Read the backend-issued refresh token from cookies (client-side).
 */
export function getStoredRefreshToken(): string | null {
  return readCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
}

/**
 * Remove all backend-issued auth tokens from cookies.
 */
export function clearAuthTokens() {
  removeCookie(AUTH_STORAGE_KEYS.ACCESS_TOKEN)
  removeCookie(AUTH_STORAGE_KEYS.REFRESH_TOKEN)
  removeCookie(AUTH_STORAGE_KEYS.ID_TOKEN)
}
