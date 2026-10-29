import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

/** organization_id scopes the key to one organization; leave it out for a global key. */
export type APIKeyBody = {
  name: string
  expires_in_days: number
  organization_id?: string
  read_only?: boolean
}

export type APIKeyResources = {
  list: () => Promise<AxiosListResponse<Models.APIKey>>
  store: (body: APIKeyBody) => Promise<AxiosItemResponse<Models.CreatedAPIKey>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
}
