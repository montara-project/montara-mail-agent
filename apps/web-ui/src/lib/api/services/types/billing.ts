import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type BillingResources = {
  plans: () => Promise<AxiosListResponse<Models.BillingPlan>>
  subscription: () => Promise<AxiosItemResponse<Models.Subscription | null>>
  checkout: (body: { plan_code: string }) => Promise<AxiosItemResponse<Models.Subscription>>
  autoRenew: (body: { enabled: boolean }) => Promise<AxiosItemResponse<unknown>>
  wallet: () => Promise<AxiosItemResponse<Models.WalletBalance>>
  walletTopups: (params: {
    offset: number
    limit: number
  }) => Promise<AxiosListResponse<Models.WalletTopup>>
  walletTopup: (body: { amount_idr: number }) => Promise<AxiosItemResponse<Models.WalletTopup>>
}
