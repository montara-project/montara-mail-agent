import { env } from '@/config/env'
import { COMMUNITY } from '@/lib/constants/edition'

import { clearAuthTokens } from '../auth/token-storage'

/** The server this browser uses until the Community Edition picks another one. */
export const DEFAULT_SERVER_URL = env.VITE_API_URL

const STORAGE_KEY = 'montara.server_url'

function storedServerURL() {
  try {
    const url = localStorage.getItem(STORAGE_KEY)
    // A hosted build ignores a stored choice and cleans it up: the address and
    // the session both belong to the server it pointed at.
    if (url && !COMMUNITY) {
      localStorage.removeItem(STORAGE_KEY)
      clearAuthTokens()
      return null
    }
    return url
  } catch {
    return null
  }
}

/**
 * The server this browser talks to; read once, since switching reloads the
 * app. Only the Community Edition can pick one; any other edition ignores a
 * stored choice.
 */
export const SERVER_URL = (COMMUNITY && storedServerURL()) || DEFAULT_SERVER_URL

/** `https://mail.example.com/` → `https://mail.example.com`. */
export function normalizeServerURL(url: string) {
  return url.trim().replace(/\/+$/, '')
}

/** Throws unless a Montara API answers at `url`. */
export async function checkServer(url: string) {
  let body: { data?: { status?: string } } | null = null
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) })
    body = await res.json()
  } catch {
    // Fetch fails alike on DNS, TLS, CORS and mixed content; say what to check.
  }
  if (body?.data?.status !== 'ok') {
    throw new Error(
      `No Montara server answered at ${url}. Check the address, that it uses https, and that the server lists ${window.location.origin} in CORS_ALLOWED_ORIGINS.`
    )
  }
}

/**
 * Use another server, or the default one for `null`. The session belongs to
 * the old server, so this signs out and starts over at the sign-in page.
 */
export function switchServer(url: string | null) {
  if (url && url !== DEFAULT_SERVER_URL) localStorage.setItem(STORAGE_KEY, url)
  else localStorage.removeItem(STORAGE_KEY)
  clearAuthTokens()
  window.location.assign('/sign-in')
}
