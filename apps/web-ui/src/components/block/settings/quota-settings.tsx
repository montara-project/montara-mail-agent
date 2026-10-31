import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, ExternalLink, Loader2, Sparkles } from 'lucide-react'
import React from 'react'

import type { TopupCheckout, TokenTopup } from '@/lib/api/models/quota'

import QueryState from '@/components/block/common/query-state'
import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { monthDay } from '@/lib/date'
import { formatRupiah, formatTokens } from '@/lib/string'
import { cn } from '@/lib/utils'

const statusVariant: Record<TokenTopup['status'], 'success' | 'secondary' | 'destructive'> = {
  paid: 'success',
  pending: 'secondary',
  expired: 'secondary',
  failed: 'destructive',
}

/** A top-up's status, the same on the billing page and its invoice. */
export function TopupStatusBadge({ status }: { status: TokenTopup['status'] }) {
  return (
    <Badge variant={statusVariant[status]} appearance="light" size="sm" className="capitalize">
      {status}
    </Badge>
  )
}

/** Control Center > Billing: the plan, the weekly AI usage against the plan's
 * allowance, and the pay-as-you-go balance a top-up fills. */
export default function QuotaSettings() {
  const quotaQuery = useQuery(queries.quota.status())
  const topupsQuery = useQuery(queries.quota.topups())
  const { data: quota, isPending } = quotaQuery
  const topups = topupsQuery.data
  const [checkout, setCheckout] = React.useState<TopupCheckout | null>(null)

  const create = useMutation(queries.quota.createTopup())

  const subscribed = quota?.plan === 'subscribed'
  const used = quota?.used_tokens ?? 0
  const limit = quota?.limit_tokens ?? null
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  // A null limit is a subscribed plan or a super user: neither has a meter.
  const unlimited = quota?.limit_tokens === null

  const startTopup = () =>
    create.mutate(undefined, {
      onError: toastAxiosError,
      onSuccess: (result) => setCheckout(result),
    })

  // The payment may have landed while the dialog was open, inside staleTime.
  const closeCheckout = () => {
    setCheckout(null)
    void quotaQuery.refetch()
    void topupsQuery.refetch()
  }

  return (
    <div className="grid gap-4">
      <SectionCard
        title="Plan & usage"
        description="The weekly AI allowance your plan carries, and what it has spent."
        toolbar={
          !quota ? undefined : unlimited ? (
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
        <QueryState
          isPending={isPending}
          isError={quotaQuery.isError && !quota}
          error={quotaQuery.error}
          onRetry={() => void quotaQuery.refetch()}
          isEmpty={false}
          loading={<Skeleton className="h-9 w-full" />}
          empty={null}
        >
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">This week's usage</span>
              <span className="tabular-nums">
                {formatTokens(used)}
                {limit !== null && ` / ${formatTokens(limit)}`} tokens
              </span>
            </div>
            {subscribed && (
              <p className="text-muted-foreground text-sm">
                100M tokens a week, and the pay-as-you-go balance on top.
              </p>
            )}
            {!unlimited && (
              <div aria-hidden="true" className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className={cn(
                    'h-full rounded-full',
                    percent >= 100 ? 'bg-destructive' : 'bg-primary'
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
            {!unlimited && percent >= 100 && (
              <p className="text-destructive text-xs">
                The weekly allowance is spent; new AI calls draw from the pay-as-you-go balance.
              </p>
            )}
          </div>
        </QueryState>
      </SectionCard>

      <SectionCard
        title="Pay as you go"
        description="10M tokens per Rp10.000, spent only once the weekly allowance runs out, never expiring."
        toolbar={
          <Button size="sm" disabled={isPending || create.isPending} onClick={startTopup}>
            {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Top up 10M for Rp10.000
          </Button>
        }
      >
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Balance</span>
          {isPending ? (
            <Skeleton className="h-5 w-20" />
          ) : (
            <span className="font-medium tabular-nums">
              {/* The Plan & usage card already carries the error and its retry. */}
              {quota ? `${formatTokens(quota.payg_balance_tokens)} tokens` : '–'}
            </span>
          )}
        </div>

        <div className="mt-4 empty:hidden">
          <QueryState
            isPending={topupsQuery.isPending}
            isError={topupsQuery.isError && !topups}
            error={topupsQuery.error}
            onRetry={() => void topupsQuery.refetch()}
            isEmpty={!topups?.length}
            loading={null}
            empty={null}
          >
            <div className="grid gap-1">
              <p className="text-muted-foreground text-xs font-medium">Recent top-ups</p>
              <ul className="-mx-2 grid">
                {topups?.slice(0, 5).map((topup: TokenTopup) => {
                  const date = monthDay(new Date(topup.created_at), true)
                  return (
                    <li
                      key={topup.id}
                      className="hover:bg-accent/50 relative grid grid-cols-[minmax(0,1fr)_auto_4rem_1rem] items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors sm:gap-3"
                    >
                      {/* The whole row opens the invoice. */}
                      <Link
                        to="/settings/billing/invoice/$id"
                        params={{ id: topup.id }}
                        aria-label={`Invoice from ${date}`}
                        className="text-muted-foreground truncate tabular-nums outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
                      >
                        {date}
                      </Link>
                      <span className="tabular-nums">{formatTokens(topup.tokens)} tokens</span>
                      <span className="justify-self-end">
                        <TopupStatusBadge status={topup.status} />
                      </span>
                      <ChevronRight className="text-muted-foreground size-4" aria-hidden />
                    </li>
                  )
                })}
              </ul>
            </div>
          </QueryState>
        </div>
      </SectionCard>

      <Dialog open={checkout !== null} onOpenChange={(open) => !open && closeCheckout()}>
        <DialogContent className="sm:max-w-md">
          <div className="grid gap-1.5">
            <DialogTitle>Complete your top-up</DialogTitle>
            <DialogDescription>
              {checkout
                ? `${formatTokens(checkout.tokens)} tokens for ${formatRupiah(checkout.amount_idr)}. `
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
              <Button variant="outline" onClick={closeCheckout}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
