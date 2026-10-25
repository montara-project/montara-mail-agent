import type { AxiosResponse } from 'axios'

import type { AxiosDeleteResponse } from '@/types/api'

import type {
  GoogleAuthUrl,
  MeData,
  SignInData,
  TokenPairData,
  TOTPRedirect,
  TOTPSetup,
} from '../../models/user'

export type TOTPVerifyBody = {
  code: string
  /** Skip the code on this browser for 30 days. */
  trust_device?: boolean
}

export type AuthResources = {
  signIn: (body: {
    email: string
    password: string
  }) => Promise<AxiosResponse<SignInData | TOTPRedirect>>
  me: () => Promise<AxiosResponse<MeData>>
  signOut: () => Promise<AxiosDeleteResponse>
  totpEnable: () => Promise<AxiosResponse<TOTPSetup>>
  totpDisable: () => Promise<AxiosResponse<{ message: string }>>
  totpBackupCodes: () => Promise<AxiosResponse<{ backup_codes: string[] }>>
  /** A code from the app, or with backup a backup code; answers like a sign-in. */
  totpVerify: (body: TOTPVerifyBody, backup?: boolean) => Promise<AxiosResponse<SignInData>>
  /**
   * GET the Google consent URL. A server without GOOGLE_CLIENT_ID answers
   * 400 — the caller turns that into the "not set up" message.
   */
  googleAuthorize: (redirectTo: string) => Promise<AxiosResponse<GoogleAuthUrl>>
  /** Trade the session cookie the Google callback left for a token pair. */
  exchangeSessionTokens: () => Promise<AxiosResponse<TokenPairData>>
}
