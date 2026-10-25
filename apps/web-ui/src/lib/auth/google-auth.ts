import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { storeSignIn } from './email-auth'

/**
 * The address the provider's callback returns the browser to. The `via`
 * marker is what tells the sign-in page to trade the session cookie for a
 * token pair (see completeGoogleSignIn).
 */
function returnAddress() {
  return `${window.location.origin}/sign-in?via=google`
}

/**
 * Start Google sign-in: ask the API for the consent URL and hand it back for
 * the caller to navigate to. A server without GOOGLE_CLIENT_ID runs the
 * oauth2 plugin disabled (404) or with the provider off (400) — both read as
 * the setup message; everything else keeps the API's message.
 */
export async function startGoogleSignIn(): Promise<string> {
  try {
    const res = await services.auth.googleAuthorize(returnAddress())
    return res.data.auth_url
  } catch (error) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 400 || status === 404) {
      throw new Error("Login with Google hasn't been set up on this server")
    }
    throwAxiosError(error)
  }
}

/**
 * Finish Google sign-in. The callback leaves a session cookie on the API's
 * origin and only redirects the browser on, so the token pair comes from
 * trading that cookie at POST /token. A consent screen abandoned midway, and
 * an API on another origin (its SameSite=Lax cookie stays there), both fail
 * here: the caller stays on the sign-in page, where the email form works.
 */
export async function completeGoogleSignIn(): Promise<void> {
  const res = await services.auth.exchangeSessionTokens()
  storeSignIn(res.data)
}
