import type { SignInDto } from '../dtos/auth/schema'
import type { AuthResources } from './types/auth'

import { api } from '../client-fetch'

const path = '/api/v1/auth'

// The two-factor step goes by the pending cookie the sign-in (or enable)
// sets, so those calls carry cookies even when the API is on another origin.
const withCookies = { withCredentials: true }

const resources = (): AuthResources => ({
  signIn: (body: SignInDto) => api.post(`${path}/email-password/sign-in`, body, withCookies),
  me: () => api.get(`${path}/me`),
  signOut: () => api.post(`${path}/sign-out`),
  totpEnable: () => api.post(`${path}/totp/enable`, {}, withCookies),
  totpDisable: () => api.post(`${path}/totp/disable`, {}),
  totpBackupCodes: () => api.post(`${path}/totp/generate-backup-codes`, {}),
  totpVerify: (body, backup) =>
    api.post(`${path}/totp/${backup ? 'verify-backup-code' : 'verify'}`, body, withCookies),
})

export const authServices = resources()
