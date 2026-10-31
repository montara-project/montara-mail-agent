/** GET /me/quota: the plan, the week's usage and the pay-as-you-go balance. */
export interface QuotaStatus {
  plan: 'free' | 'subscribed'
  week_start: string
  used_tokens: number
  /** Null when the plan is subscribed: the app shows that as Unlimited. */
  limit_tokens: number | null
  payg_balance_tokens: number
}

/** A pay-as-you-go purchase: 10M tokens per Rp10,000 through BorderPay. */
export interface TokenTopup {
  id: string
  created_at: string
  amount_idr: number
  tokens: number
  status: 'pending' | 'paid' | 'expired' | 'failed'
  reference_id: string
  pay_url: string
  paid_at: string | null
}

/** POST /me/quota/topups: the checkout the user finishes the payment at. */
export interface TopupCheckout {
  id: string
  status: 'pending'
  amount_idr: number
  tokens: number
  pay_url: string
  qr_string: string
  expires_at: string
}
