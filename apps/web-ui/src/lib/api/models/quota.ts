/** GET /me/quota: the plan, the week's usage and the pay-as-you-go balance. */
export interface QuotaStatus {
  plan: 'free' | 'pro' | 'enterprise'
  used_tokens: number
  /** Null when the tier is unlimited (enterprise, or a super user). */
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

/** POST /me/quota/topups: a token purchase debited from the IDR wallet, so it
 * lands already paid and carries no checkout URL. */
export interface TopupCheckout {
  id: string
  status: 'paid'
  amount_idr: number
  tokens: number
  pay_url: string
}
