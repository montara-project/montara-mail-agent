/** A pricing plan row: pricing plus the limits a tier carries. */
export interface BillingPlan {
  code: string
  name: string
  description: string
  billing_interval: 'month' | 'year' | null
  amount: number
  currency: string
  discount_amount: number
  discount_ends_at: string | null
  max_email_accounts: number | null
  max_organizations: number | null
  weekly_tokens: number | null
}

/** One paid period of a recurring plan, or the pending checkout for one. */
export interface Subscription {
  id: string
  created_at: string
  plan_code: string
  plan_name: string
  billing_interval: 'month' | 'year' | null
  status: 'pending' | 'active' | 'expired' | 'canceled'
  current_period_start: string | null
  current_period_end: string | null
  amount: number
  pay_url: string
  auto_renew: boolean
  canceled_at: string | null
}

/** The IDR wallet balance. */
export interface WalletBalance {
  balance_idr: number
}

/** One wallet ledger entry: a top-up credit, a subscription charge, or an adjustment. */
export interface WalletTransaction {
  id: string
  created_at: string
  kind: 'topup' | 'subscription_charge' | 'adjustment'
  amount_idr: number
  reference_type: string
  note: string
}

/** One wallet top-up paid through BorderPay's QRIS checkout. */
export interface WalletTopup {
  id: string
  created_at: string
  amount_idr: number
  status: 'pending' | 'paid' | 'expired' | 'failed'
  pay_url: string
  paid_at: string | null
}
