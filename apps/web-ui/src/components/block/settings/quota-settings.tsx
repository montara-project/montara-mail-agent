import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react'
import React from 'react'

import type { TokenTopup, TopupCheckout } from '@/lib/api/models/quota'

import QueryState from '@/components/block/common/query-state'
import SectionCard from '@/components/block/common/section-card'
import PlanCard from '@/components/block/settings/billing/plan-card'
import PlansComparison from '@/components/block/settings/billing/plans-comparison'
import TopupStatusBadge from '@/components/block/settings/billing/topup-status-badge'
import UsageBar from '@/components/block/settings/billing/usage-bar'
import WalletCard from '@/components/block/settings/billing/wallet-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { monthDay } from '@/lib/date'
import { formatRupiah, formatTokens } from '@/lib/string'
import { cn } from '@/lib/utils'

/** The page sizes the top-up history offers; the first is the default. */
const TOPUP_PAGE_SIZES = [10, 25, 50] as const

/** Control Center > Billing: the plan, the weekly AI usage against the plan's
 * allowance, and the pay-as-you-go balance a top-up fills. */
export default function QuotaSettings() {
  const quotaQuery = useQuery(queries.quota.status())
  const securityQuery = useQuery(queries.profile.security())
  // A super user has no limit to buy past. Hidden until known, so it never flashes.
  const showPurchases = !securityQuery.isPending && !securityQuery.data?.super_user
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState<number>(TOPUP_PAGE_SIZES[0])
  const first = (page - 1) * pageSize
  const topupsQuery = useQuery(queries.quota.topups({ offset: first, limit: pageSize }))
  const { data: quota, isPending } = quotaQuery
  const topups = topupsQuery.data?.data
  const topupTotal = topupsQuery.data?.metadata?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(topupTotal / pageSize))
  const [checkout, setCheckout] = React.useState<TopupCheckout | null>(null)
  const [checkoutOpen, setCheckoutOpen] = React.useState(false)
  const payLink = React.useRef<HTMLAnchorElement>(null)

  const create = useMutation(queries.quota.createTopup())

  const isPro = quota?.plan === 'pro'
  const used = quota?.used_tokens ?? 0
  const limit = quota?.limit_tokens ?? null
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  // A null limit is an enterprise plan or a super user: neither has a meter.
  const unlimited = quota?.limit_tokens === null

  const startTopup = () =>
    create.mutate(undefined, {
      onError: toastAxiosError,
      onSuccess: (result) => {
        setCheckout(result)
        // The new top-up lands at the top of the first page.
        setPage(1)
        setCheckoutOpen(true)
      },
    })

  // The payment may have landed while the dialog was open, inside staleTime.
  const closeCheckout = () => {
    setCheckoutOpen(false)
    void quotaQuery.refetch()
    void topupsQuery.refetch()
  }

  return (
    <div className="grid gap-4">
      <WalletCard />

      <PlanCard>
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
            {isPro && (
              <p className="text-muted-foreground text-sm">
                100M tokens a week, and the pay-as-you-go balance on top.
              </p>
            )}
            {limit !== null && <UsageBar used={used} limit={limit} />}
            {!unlimited && percent >= 100 && (
              <p className="text-destructive text-xs">
                The weekly allowance is spent; new AI calls draw from the pay-as-you-go balance.
              </p>
            )}
          </div>
        </QueryState>
      </PlanCard>

      {showPurchases && <PlansComparison />}

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
                {topups?.map((topup: TokenTopup) => {
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
              {topupTotal > TOPUP_PAGE_SIZES[0] && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                    {first + 1}–{first + (topups?.length ?? 0)} of {topupTotal}
                  </span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value))
                      setPage(1)
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      // As quiet as the page buttons beside it, like the mail list's.
                      className="text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground ms-auto h-7 w-auto gap-1 border-transparent bg-transparent px-2 text-xs font-normal shadow-none"
                      aria-label="Top-ups per page"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" align="end">
                      {TOPUP_PAGE_SIZES.map((option) => (
                        <SelectItem key={option} value={String(option)} className="text-xs">
                          {option} per page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Pagination className={cn('mx-0 w-auto', pageCount <= 1 && 'hidden')}>
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          variant="ghost"
                          mode="icon"
                          size="sm"
                          aria-label="Previous page"
                          disabled={page === 1}
                          onClick={() => setPage(page - 1)}
                        >
                          <ChevronLeft className="rtl:rotate-180" />
                        </Button>
                      </PaginationItem>
                      <PaginationItem>
                        <span className="text-muted-foreground px-2 text-xs tabular-nums">
                          {page} / {pageCount}
                        </span>
                      </PaginationItem>
                      <PaginationItem>
                        <Button
                          variant="ghost"
                          mode="icon"
                          size="sm"
                          aria-label="Next page"
                          disabled={page >= pageCount}
                          onClick={() => setPage(page + 1)}
                        >
                          <ChevronRight className="rtl:rotate-180" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </QueryState>
        </div>
      </SectionCard>

      <Dialog open={checkoutOpen} onOpenChange={(open) => !open && closeCheckout()}>
        {/* Kept after closing, so the dialog doesn't empty while it animates out. */}
        {checkout && (
          <DialogContent
            className="gap-0 p-0 sm:max-w-md"
            // Radix skips links when it picks the first focus, which would land on Done.
            onOpenAutoFocus={(e) => {
              e.preventDefault()
              payLink.current?.focus()
            }}
          >
            <div className="grid gap-5 p-6">
              <div className="grid gap-1.5 pe-8">
                <DialogTitle>Complete your top-up</DialogTitle>
                <DialogDescription>
                  Scan the QRIS or pay at the BorderPay checkout.
                </DialogDescription>
              </div>
              <dl className="divide-y border-y text-sm">
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-muted-foreground">Top-up</dt>
                  <dd className="tabular-nums">{formatTokens(checkout.tokens)} tokens</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="font-medium">Total</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {formatRupiah(checkout.amount_idr)}
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground text-xs leading-5">
                The balance is credited automatically once the payment lands, usually within
                seconds. It never expires and is spent only after the weekly allowance.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t p-4">
              <Button variant="outline" onClick={closeCheckout}>
                Done
              </Button>
              <Button asChild>
                <a ref={payLink} href={checkout.pay_url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Open the payment page
                </a>
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
