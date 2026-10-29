import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type APIKeyBody = { name: string; expires_in_days: number }

export type APIKeyResources = {
  list: () => Promise<AxiosListResponse<Models.APIKey>>
  store: (body: APIKeyBody) => Promise<AxiosItemResponse<Models.CreatedAPIKey>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
}
