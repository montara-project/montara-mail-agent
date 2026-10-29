import type { AxiosResponse } from 'axios'

import type { ApiListResponse, AxiosDeleteResponse, AxiosItemResponse, Metadata } from '@/types/api'

import type { Models } from '../../models'

export type IPBlockBody = { address: string; reason: string; expires_in_hours: number }

export type IPBlockListResponse = ApiListResponse<
  Models.IPBlock,
  Metadata & {
    /** The automatic rule: this many failures within the window block for block_minutes. */
    auto: {
      failed_sign_ins: number
      rate_limit_hits: number
      window_minutes: number
      block_minutes: number
    }
    /** The address the server sees for this browser, which can't be blocked from here. */
    your_ip: string
  }
>

export type IPBlockResources = {
  list: () => Promise<AxiosResponse<IPBlockListResponse>>
  store: (body: IPBlockBody) => Promise<AxiosItemResponse<Models.IPBlock>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
}
