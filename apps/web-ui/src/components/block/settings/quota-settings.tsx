import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, Sparkles } from 'lucide-react'
import React from 'react'

import type { TopupCheckout, TokenTopup } from '@/lib/api/models/quota'

import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

/** Formats a token count compactly: 12,345,678 → 12.3M. */
function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

/** Control Center > Billing: the plan, the weekly AI usage against the plan's
 * allowance, and the pay-as-you-go balance a top-up fills. */
export default function QuotaSettings() {
  const { data: quota, isPending } = useQuery(queries.quota.status())
  const { data: topups } = useQuery(queries.quota.topups())
  const [checkout, setCheckout] = React.useState<TopupCheckout | null>(null)

  const create = useMutation(queries.quota.createTopup())

  const subscribed = quota?.plan === 'subscribed'
  const used = quota?.used_tokens ?? 0
  const limit = quota?.limit_tokens ?? null
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0

  const startTopup = () =>
    create.mutate(undefined, {
      onError: toastAxiosError,
      onSuccess: (result) => setCheckout(result),
    })

  return (
    <div className="grid gap-4">
      <SectionCard
        title="Plan & usage"
        description="The weekly AI allowance your plan carries, and what it has spent."
        toolbar={
          subscribed ? (
            <Badge variant="success" appearance="light">
              <Sparkles aria-hidden />
              Unlimited
            </Badge>
          ) : (
            <Badge variant="secondary" appearance="light">
              Free
            </Badge>
          )
        }
      >
        {subscribed ? (
          <p className="text-muted-foreground text-sm">
            100M tokens a week, and the pay-as-you-go balance on top.
          </p>
        ) : (
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">This week's usage</span>
              <span className="tabular-nums">
                {formatTokens(used)} / {limit ? formatTokens(limit) : '–'}
              </span>
            </div>
            <div aria-hidden="true" className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full rounded-full',
                  percent >= 100 ? 'bg-destructive' : 'bg-primary'
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
            {percent >= 100 && (
              <p className="text-destructive text-xs">
                The weekly allowance is spent; new AI calls draw from the pay-as-you-go balance.
              </p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Pay as you go"
        description="10M tokens per Rp10,000, spent only once the weekly allowance runs out, never expiring."
        toolbar={
          <Button size="sm" disabled={isPending || create.isPending} onClick={startTopup}>
            Top up 10M — Rp10.000
          </Button>
        }
      >
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-medium tabular-nums">
            {formatTokens(quota?.payg_balance_tokens ?? 0)} tokens
          </span>
        </div>

        {topups && topups.length > 0 && (
          <div className="mt-4 grid gap-2">
            <p className="text-muted-foreground text-xs font-medium">Recent top-ups</p>
            <ul className="grid gap-1.5">
              {topups.slice(0, 5).map((topup: TokenTopup) => (
                <li key={topup.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {new Date(topup.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="tabular-nums">{formatTokens(topup.tokens)} tokens</span>
                  <Badge
                    variant={topup.status === 'paid' ? 'success' : 'secondary'}
                    appearance="light"
                    size="sm"
                  >
                    {topup.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SectionCard>

      <Dialog open={checkout !== null} onOpenChange={(open) => !open && setCheckout(null)}>
        <DialogContent className="sm:max-w-md">
          <div className="grid gap-1.5">
            <DialogTitle>Complete your top-up</DialogTitle>
            <DialogDescription>
              {checkout
                ? `${formatTokens(checkout.tokens)} tokens for Rp${checkout.amount_idr.toLocaleString('id-ID')}. `
                : ''}
              The balance never expires and is spent only after the weekly allowance.
            </DialogDescription>
          </div>
          {checkout && (
            <div className="grid gap-3">
              <Button asChild>
                <a href={checkout.pay_url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Open the payment page
                </a>
              </Button>
              <p className="text-muted-foreground text-xs">
                Scan the QRIS or pay at the BorderPay checkout. The balance is credited
                automatically once the payment lands, usually within seconds.
              </p>
              <Button variant="outline" onClick={() => setCheckout(null)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
