import type { PasskeyResources } from './types/passkey'

import { api } from '../client-fetch'

const path = '/api/v1/me/passkeys'

const resources = (): PasskeyResources => ({
  list: () => api.get(path),
  options: () => api.post(`${path}/options`),
  store: (body) => api.post(path, body),
  delete: (id) => api.delete(`${path}/${id}`),
})

export const passkeyServices = resources()
