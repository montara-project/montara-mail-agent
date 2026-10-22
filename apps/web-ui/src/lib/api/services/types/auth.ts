import type { AxiosResponse } from 'axios'

import type { AxiosDeleteResponse } from '@/types/api'

import type { MeData, SignInData } from '../../models/user'

export type AuthResources = {
  signIn: (body: { email: string; password: string }) => Promise<AxiosResponse<SignInData>>
  me: () => Promise<AxiosResponse<MeData>>
  signOut: () => Promise<AxiosDeleteResponse>
}
