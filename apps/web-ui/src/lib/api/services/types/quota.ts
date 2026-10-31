import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type QuotaResources = {
  status: () => Promise<AxiosItemResponse<Models.QuotaStatus>>
  listTopups: (params: {
    offset: number
    limit: number
  }) => Promise<AxiosListResponse<Models.TokenTopup>>
  topup: (id: string) => Promise<AxiosItemResponse<Models.TokenTopup>>
  createTopup: () => Promise<AxiosItemResponse<Models.TopupCheckout>>
}
