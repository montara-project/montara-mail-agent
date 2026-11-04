import type { AxiosResponse } from 'axios'

import type { AxiosDeleteResponse } from '@/types/api'

import type {
  MeData,
  OAuthAuthUrl,
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
   * GET a provider's consent URL. A server without that provider's client id
   * answers 400 or 404 — the caller turns that into the "not set up" message.
   */
  oauthAuthorize: (
    provider: 'google' | 'microsoft',
    redirectTo: string
  ) => Promise<AxiosResponse<OAuthAuthUrl>>
  /** The challenge for navigator.credentials.get; names no account. */
  passkeyOptions: () => Promise<AxiosResponse<{ publicKey: PublicKeyCredentialRequestOptionsJSON }>>
  /** The browser's signed answer; answers like a sign-in, with no two-factor step. */
  passkeySignIn: (credential: AuthenticationResponseJSON) => Promise<AxiosResponse<SignInData>>
  /** Trade the session cookie an OAuth callback left for a token pair. */
  exchangeSessionTokens: () => Promise<AxiosResponse<TokenPairData>>
}
