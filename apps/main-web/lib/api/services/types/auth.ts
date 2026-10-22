import type { AxiosDeleteResponse, AxiosItemResponse } from '@/types/api'

import type { SignInData, User } from '../../models/user'

export type AuthResources = {
  signIn: (body: { email: string; password: string }) => Promise<AxiosItemResponse<SignInData>>
  me: () => Promise<AxiosItemResponse<User>>
  signOut: () => Promise<AxiosDeleteResponse>
}
