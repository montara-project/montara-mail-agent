import type { BillingResources } from './types/billing'

import { api } from '../client-fetch'

const path = '/api/v1/me/billing'

const resources = (): BillingResources => ({
  plans: () => api.get(`${path}/plans`),
  subscription: () => api.get(`${path}/subscription`),
  checkout: (body) => api.post(`${path}/subscription/checkout`, body),
  autoRenew: (body) => api.post(`${path}/subscription/auto-renew`, body),
  wallet: () => api.get(`${path}/wallet`),
  walletTopups: (params) => api.get(`${path}/wallet/topups`, { params }),
  walletTopup: (body) => api.post(`${path}/wallet/topup`, body),
})

export const billingServices = resources()
