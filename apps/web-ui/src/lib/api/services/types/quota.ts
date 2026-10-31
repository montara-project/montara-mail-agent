import type { AxiosItemResponse } from '@/types/api'

import type { Models } from '../../models'

export type QuotaResources = {
  status: () => Promise<AxiosItemResponse<Models.QuotaStatus>>
  listTopups: () => Promise<AxiosItemResponse<Models.TokenTopup[]>>
  topup: (id: string) => Promise<AxiosItemResponse<Models.TokenTopup>>
  createTopup: () => Promise<AxiosItemResponse<Models.TopupCheckout>>
}
