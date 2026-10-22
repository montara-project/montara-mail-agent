import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { clearAuthTokens, setAuthTokens } from './token-storage'

interface SignInWithEmailParams {
  email: string
  password: string
}

/**
 * Authenticate against the Go API (NEXT_PUBLIC_API_URL) with email + password.
 * On success the returned tokens are stored and attached to subsequent API requests
 * by the axios interceptor in `client-fetch.ts`.
 */
export async function signInWithEmail({ email, password }: SignInWithEmailParams) {
  try {
    const res = await services.auth.signIn({ email, password })
    const payload = res?.data?.data

    if (!payload?.access_token) {
      throw new Error('Sign-in response did not include an access token')
    }

    setAuthTokens({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      idToken: payload.id_token,
      expiresIn: payload.expires_in,
    })

    return res?.data
  } catch (error) {
    throwAxiosError(error as Error)
  }
}

/**
 * Sign out: the API ends the session, then the stored tokens are dropped.
 * Best-effort — a session that is already gone still leaves the client signed out.
 */
export async function signOut() {
  try {
    await services.auth.signOut()
  } catch {
    // Ignore: there is no session left to end.
  } finally {
    clearAuthTokens()
  }
}
