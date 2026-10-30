import type { SignInData, TokenPairData, TOTPRedirect } from '../api/models/user'
import type { TOTPVerifyBody } from '../api/services/types/auth'

import { throwAxiosError } from '../api/axios-error'
import { services } from '../api/services'
import { clearAuthTokens, setAuthTokens } from './token-storage'

interface SignInWithEmailParams {
  email: string
  password: string
}

/**
 * Store the token pair a completed sign-in answers with. Both a sign-in body
 * and the POST /token answer carry the same four fields.
 */
export function storeSignIn(payload?: SignInData | TokenPairData) {
  if (!payload?.access_token) {
    throw new Error('Sign-in response did not include an access token')
  }

  setAuthTokens({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
  })
}

/**
 * Authenticate against the Go API (VITE_API_URL) with email + password.
 * On success the returned tokens are stored and attached to subsequent API requests
 * by the axios interceptor in `client-fetch.ts`. A user with two-factor
 * sign-in gets no tokens yet: the answer is `{ totp_redirect: true }`, and
 * `verifyTOTP` finishes the sign-in.
 */
export async function signInWithEmail({
  email,
  password,
}: SignInWithEmailParams): Promise<SignInData | TOTPRedirect | undefined> {
  try {
    const res = await services.auth.signIn({ email, password })
    const payload = res?.data

    if (payload && 'totp_redirect' in payload && payload.totp_redirect) {
      return payload
    }
    storeSignIn(payload as SignInData)
    return payload
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 401) {
      throw new Error('Wrong email or password.')
    }
    throwAxiosError(error as Error)
  }
}

/** The second step of a sign-in: a code from the app, or a backup code. */
export async function verifyTOTP(body: TOTPVerifyBody, backup = false) {
  try {
    const res = await services.auth.totpVerify(body, backup)
    storeSignIn(res.data)
    return res.data
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
