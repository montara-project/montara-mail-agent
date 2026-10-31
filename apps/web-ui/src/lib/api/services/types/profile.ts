import type { AxiosResponse } from 'axios'

import type { AxiosItemResponse } from '@/types/api'

import type { UpdatePasswordDto, UpdateProfileDto } from '../../dtos/settings/profile/schema'
import type { User, UserSecurity } from '../../models/user'

export type ProfileResources = {
  security: () => Promise<AxiosItemResponse<UserSecurity>>
  update: (body: UpdateProfileDto) => Promise<AxiosItemResponse<User>>
  updatePreferences: (body: {
    split_inbox?: boolean
    agent_panel?: 'beside' | 'floating'
  }) => Promise<AxiosItemResponse<User>>
  /** Ends every session: the caller signs in again. */
  changePassword: (body: Omit<UpdatePasswordDto, 'confirm_password'>) => Promise<AxiosResponse>
}
