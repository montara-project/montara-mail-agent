import type { AxiosResponse } from 'axios'

import type { AxiosItemResponse } from '@/types/api'

import type { Models } from '../../models'

export type QuotaResources = {
  status: () => Promise<AxiosItemResponse<Models.QuotaStatus>>
  listTopups: () => Promise<AxiosResponse<Models.TokenTopup[]>>
  createTopup: () => Promise<AxiosItemResponse<Models.TopupCheckout>>
}
