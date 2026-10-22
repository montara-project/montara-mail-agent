import type { SignInDto } from '../dtos/auth/schema'
import type { AuthResources } from './types/auth'

import { api } from '../client-fetch'

const path = '/api/v1/auth'

const resources = (): AuthResources => ({
  signIn: (body: SignInDto) => api.post(`${path}/sign-in`, body),
  me: () => api.get(`${path}/me`),
  signOut: () => api.post(`${path}/sign-out`),
})

export const authServices = resources()
