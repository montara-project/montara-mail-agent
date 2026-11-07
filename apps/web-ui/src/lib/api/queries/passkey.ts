import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { createPasskey } from '@/lib/auth/passkey'
import { getQueryClient } from '@/lib/providers/react-query'

import { services } from '../services'

const PASSKEY_QUERY_KEY = 'passkeys'

const invalidate = () => getQueryClient().invalidateQueries({ queryKey: [PASSKEY_QUERY_KEY] })

/** The user's passkeys, oldest first. */
const list = () =>
  queryOptions({
    queryKey: [PASSKEY_QUERY_KEY, 'list'],
    queryFn: async () => {
      const res = await services.passkeys.list()
      return res.data.data
    },
  })

/** Makes a passkey on this device, then registers it. */
const create = () =>
  mutationOptions({
    mutationFn: async ({ name, password }: { name: string; password: string }) => {
      const res = await createPasskey(name, password)
      return res.data.data
    },
    onSuccess: invalidate,
  })

const del = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.passkeys.delete(id)
      return res.data
    },
    onSuccess: invalidate,
  })

export const passkeyQueries = { list, create, delete: del } as const
