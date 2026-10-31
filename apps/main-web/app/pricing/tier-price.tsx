'use client'

import { useSyncExternalStore } from 'react'

import type { PricingTier } from '@/lib/pricing'

const fmt = (v: number) => `Rp${v.toLocaleString('id-ID')}`
const fmtDate = (date: string) =>
  new Date(date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

const noSubscribe = () => () => {}

/**
 * Whether the tier's promo still runs. The page is prerendered, so the build
 * can't know: it renders the promo, and the browser drops it once it has ended.
 */
function usePromoRunning(tier: PricingTier) {
  return useSyncExternalStore(
    noSubscribe,
    () =>
      tier.discount > 0 && (!tier.discountEndsAt || Date.parse(tier.discountEndsAt) > Date.now()),
    () => tier.discount > 0
  )
}

/** A tier's price with the promo strike-through, or Custom for a contract. */
export function TierPrice({ tier }: { tier: PricingTier }) {
  const discounted = usePromoRunning(tier)
  return (
    <>
      <div className="flex items-baseline gap-2">
        {discounted && (
          <span className="text-sm text-muted-foreground line-through">{fmt(tier.amount)}</span>
        )}
        <span className="text-3xl font-semibold tabular-nums">
          {tier.code === 'enterprise'
            ? 'Custom'
            : fmt(discounted ? tier.amount - tier.discount : tier.amount)}
        </span>
        <span className="text-sm text-muted-foreground">
          {tier.interval === 'month' ? '/mo' : tier.interval === 'year' ? '/yr' : ''}
        </span>
      </div>
      {discounted && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Save {fmt(tier.discount)} until {fmtDate(tier.discountEndsAt)}.
        </p>
      )}
    </>
  )
}

/** The tier's current price alone, for running text. */
export function CurrentPrice({ tier }: { tier: PricingTier }) {
  const discounted = usePromoRunning(tier)
  return fmt(discounted ? tier.amount - tier.discount : tier.amount)
}
