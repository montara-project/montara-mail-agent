import type { AxiosResponse } from 'axios'

import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { UpdatePasswordDto, UpdateProfileDto } from '../../dtos/settings/profile/schema'
import type { Session, User, UserSecurity } from '../../models/user'

export type ProfileResources = {
  security: () => Promise<AxiosItemResponse<UserSecurity>>
  update: (body: UpdateProfileDto) => Promise<AxiosItemResponse<User>>
  updatePreferences: (body: {
    split_inbox?: boolean
    agent_panel?: 'beside' | 'floating'
  }) => Promise<AxiosItemResponse<User>>
  /** Ends every session: the caller signs in again. */
  changePassword: (body: Omit<UpdatePasswordDto, 'confirm_password'>) => Promise<AxiosResponse>
  sessions: () => Promise<AxiosListResponse<Session>>
  /** Signs one session out; its tokens stop working at once. */
  revokeSession: (id: string) => Promise<AxiosDeleteResponse>
  /** Signs out every session but the caller's. */
  revokeOtherSessions: () => Promise<AxiosDeleteResponse>
  /** Deletes the account for good; the typed email must be the caller's own. */
  deleteAccount: (body: { email: string }) => Promise<AxiosDeleteResponse>
}
