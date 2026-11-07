import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { UpdatePasswordDto, UpdateProfileDto } from '../dtos/settings/profile/schema'

import { services } from '../services'
import { PROFILE_QUERY_KEY } from './auth'

export const SECURITY_QUERY_KEY = 'security'
const SESSIONS_QUERY_KEY = 'sessions'

const invalidateSessions = () =>
  getQueryClient().invalidateQueries({ queryKey: [SESSIONS_QUERY_KEY] })

/** Whether the user has a password and two-factor sign-in. */
const security = () =>
  queryOptions({
    queryKey: [SECURITY_QUERY_KEY],
    queryFn: async () => {
      const res = await services.profile.security()
      return res.data.data
    },
  })

const update = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (body: UpdateProfileDto) => {
      const res = await services.profile.update(body)
      return res.data.data
    },
    // The sidebar and the reply card show the name and avatar from /me.
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] }),
  })
}

const updatePreferences = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (body: { split_inbox?: boolean; agent_panel?: 'beside' | 'floating' }) => {
      const res = await services.profile.updatePreferences(body)
      return res.data.data
    },
    // /me carries them. Returned, so the mutation stays pending until it has them.
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY] }),
  })
}

const changePassword = () =>
  mutationOptions({
    mutationFn: async ({ current_password, new_password }: UpdatePasswordDto) => {
      const res = await services.profile.changePassword({ current_password, new_password })
      return res.data
    },
  })

/** Where the user is signed in, most recently active first. */
const sessions = () =>
  queryOptions({
    queryKey: [SESSIONS_QUERY_KEY],
    queryFn: async () => {
      const res = await services.profile.sessions()
      return res.data.data
    },
  })

const revokeSession = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.profile.revokeSession(id)
      return res.data
    },
    onSuccess: invalidateSessions,
  })

const revokeOtherSessions = () =>
  mutationOptions({
    mutationFn: async () => {
      const res = await services.profile.revokeOtherSessions()
      return res.data
    },
    onSuccess: invalidateSessions,
  })

/** Deletes the account; the caller's sessions end with it, so the app signs out. */
const deleteAccount = () =>
  mutationOptions({
    mutationFn: async (email: string) => {
      const res = await services.profile.deleteAccount({ email })
      return res.data
    },
  })

export const profileQueries = {
  security,
  update,
  updatePreferences,
  changePassword,
  sessions,
  revokeSession,
  revokeOtherSessions,
  deleteAccount,
} as const
