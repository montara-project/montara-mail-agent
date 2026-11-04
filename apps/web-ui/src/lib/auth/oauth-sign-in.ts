import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { storeSignIn } from './email-auth'

/** The sign-in providers the API's /oauth2 routes serve. */
export type OAuthProvider = 'google' | 'microsoft'

export const OAUTH_PROVIDER_NAMES: Record<OAuthProvider, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
}

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return value === 'google' || value === 'microsoft'
}

/**
 * The address the provider's callback returns the browser to. The `via`
 * marker is what tells the sign-in page to trade the session cookie for a
 * token pair (see completeOAuthSignIn).
 */
function returnAddress(provider: OAuthProvider) {
  return `${window.location.origin}/sign-in?via=${provider}`
}

/**
 * Start a provider sign-in: ask the API for the consent URL and hand it back
 * for the caller to navigate to. A server without that provider's client id
 * answers 404 (route or plugin off) or 400 (provider off) — both read as the
 * setup message; everything else keeps the API's message.
 */
export async function startOAuthSignIn(provider: OAuthProvider): Promise<string> {
  try {
    const res = await services.auth.oauthAuthorize(provider, returnAddress(provider))
    return res.data.auth_url
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 400 || status === 404) {
      throw new Error(
        `Login with ${OAUTH_PROVIDER_NAMES[provider]} hasn't been set up on this server`
      )
    }
    throwAxiosError(error)
  }
}

/**
 * Finish a provider sign-in. The callback leaves a session cookie on the
 * API's origin and only redirects the browser on, so the token pair comes
 * from trading that cookie at POST /token. A consent screen abandoned midway,
 * and an API on another origin (its SameSite=Lax cookie stays there), both
 * fail here: the caller stays on the sign-in page, where the email form works.
 */
export async function completeOAuthSignIn(): Promise<void> {
  const res = await services.auth.exchangeSessionTokens()
  storeSignIn(res.data)
}
