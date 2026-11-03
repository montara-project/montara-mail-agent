import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import { getQueryClient } from '@/lib/providers/react-query'

import { services } from '../services'

const BILLING_QUERY_KEY = 'billing'

/** The active plans, for the pricing comparison. */
const plans = () =>
  queryOptions({
    queryKey: [BILLING_QUERY_KEY, 'plans'],
    queryFn: async () => {
      const res = await services.billing.plans()
      return res.data.data
    },
    staleTime: 5 * 60 * 1000,
  })

/** The user's live subscription, or null; polls while its checkout is pending. */
const subscription = () =>
  queryOptions({
    queryKey: [BILLING_QUERY_KEY, 'subscription'],
    queryFn: async () => {
      const res = await services.billing.subscription()
      return res.data.data
    },
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
  })

/** The wallet balance. */
const wallet = () =>
  queryOptions({
    queryKey: [BILLING_QUERY_KEY, 'wallet'],
    queryFn: async () => {
      const res = await services.billing.wallet()
      return res.data.data
    },
  })

/** One page of the wallet top-up history. */
const walletTopups = (params: { offset: number; limit: number }) =>
  queryOptions({
    queryKey: [BILLING_QUERY_KEY, 'wallet-topups', params],
    queryFn: async () => {
      const res = await services.billing.walletTopups(params)
      return res.data
    },
    placeholderData: keepPreviousData,
  })

/** One wallet top-up, for its invoice page; polls while its checkout is pending. */
const walletTopupById = (id: string) =>
  queryOptions({
    queryKey: [BILLING_QUERY_KEY, 'wallet-topups', id],
    queryFn: async () => {
      const res = await services.billing.walletTopupById(id)
      return res.data.data
    },
    // A 404 won't change: show "not found" now, not after the retries.
    retry: (failures, error) =>
      !(isAxiosError(error) && error.response?.status === 404) && failures < 3,
    // The webhook credits a payment seconds after the customer lands back here.
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
  })

const checkout = () => {
  const qc = getQueryClient()
  return mutationOptions({
    mutationFn: async (body: { plan_code: string }) => {
      const res = await services.billing.checkout(body)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BILLING_QUERY_KEY] })
      qc.invalidateQueries({ queryKey: ['quota'] })
    },
  })
}

const autoRenew = () => {
  const qc = getQueryClient()
  return mutationOptions({
    mutationFn: async (body: { enabled: boolean }) => {
      await services.billing.autoRenew(body)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [BILLING_QUERY_KEY, 'subscription'] }),
  })
}

const walletTopup = () => {
  const qc = getQueryClient()
  return mutationOptions({
    mutationFn: async (body: { amount_idr: number }) => {
      const res = await services.billing.walletTopup(body)
      return res.data.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BILLING_QUERY_KEY] })
    },
  })
}

export const billingQueries = {
  plans,
  subscription,
  wallet,
  walletTopups,
  walletTopupById,
  checkout,
  autoRenew,
  walletTopup,
} as const
