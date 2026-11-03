import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, History, Sparkles, Wallet } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { monthDay } from '@/lib/date'
import { formatRupiah, formatTokens } from '@/lib/string'
import { cn } from '@/lib/utils'

/** The newest top-ups of each kind the card can merge — the API caps a page at 100. */
const WINDOW = 100
/** Page sizes the footer offers, 10 at the smallest. */
const PAGE_SIZES = [10, 25, 50] as const
const DEFAULT_PAGE_SIZE = 10

type LedgerRow = {
  key: string
  at: number
  kind: 'wallet' | 'tokens'
  title: string
  sub: string
  amount: number
  paid: boolean
  /** A paid or settled top-up leads to its invoice page. */
  invoiceTo?: '/settings/billing/invoice/$id' | '/settings/billing/wallet-invoice/$id'
  invoiceId?: string
  /** A pending gateway payment leads back to its checkout. */
  checkoutUrl?: string
}

const statusLabel: Record<Models.TokenTopup['status'], string> = {
  pending: 'Pending',
  paid: 'Paid',
  expired: 'Expired',
  failed: 'Failed',
}

/** Control Center > Billing: every wallet and token movement, merged and
 * paged — the design's transactions table. */
export default function RecentTransactions() {
  const tokensQuery = useQuery(queries.quota.topups({ offset: 0, limit: WINDOW }))
  const walletQuery = useQuery(queries.billing.walletTopups({ offset: 0, limit: WINDOW }))
  const [page, setPage] = React.useState(1)
  const [size, setSize] = React.useState<number>(DEFAULT_PAGE_SIZE)

  const rows = React.useMemo<LedgerRow[]>(() => {
    const tokenRows = (tokensQuery.data?.data ?? []).map<LedgerRow>((t) => ({
      key: `tokens-${t.id}`,
      at: new Date(t.created_at).getTime(),
      kind: 'tokens',
      title: `AI tokens · ${formatTokens(t.tokens)}`,
      sub: `${monthDay(new Date(t.created_at), true)} · ${
        t.status === 'paid' ? (t.pay_url ? 'BorderPay' : 'Paid from wallet') : statusLabel[t.status]
      }`,
      amount: t.amount_idr,
      paid: t.status === 'paid',
      // A gateway purchase still waiting leads back to its checkout; any other
      // state has an invoice page, legacy QRIS ones included.
      checkoutUrl: t.status === 'pending' && t.pay_url ? t.pay_url : undefined,
      invoiceTo: '/settings/billing/invoice/$id',
      invoiceId: t.status === 'pending' && t.pay_url ? undefined : t.id,
    }))
    const walletRows = (walletQuery.data?.data ?? []).map<LedgerRow>((t) => ({
      key: `wallet-${t.id}`,
      at: new Date(t.created_at).getTime(),
      kind: 'wallet',
      title: 'Wallet top up',
      sub: `${monthDay(new Date(t.created_at), true)} · ${statusLabel[t.status]}`,
      amount: t.amount_idr,
      paid: t.status === 'paid',
      // A pending top-up's pay page is its way back to the checkout; any other
      // state has a wallet invoice page, same as the token rows.
      checkoutUrl: t.status === 'pending' && t.pay_url ? t.pay_url : undefined,
      invoiceTo: '/settings/billing/wallet-invoice/$id',
      invoiceId: t.status === 'pending' && t.pay_url ? undefined : t.id,
    }))
    return [...tokenRows, ...walletRows].sort((a, b) => b.at - a.at)
  }, [tokensQuery.data, walletQuery.data])

  // More of a kind than the window fetched stays on the server; the count says so.
  const truncated =
    (tokensQuery.data?.metadata.total ?? 0) > (tokensQuery.data?.data.length ?? 0) ||
    (walletQuery.data?.metadata.total ?? 0) > (walletQuery.data?.data.length ?? 0)

  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  // Rows leaving under the cursor can empty the page it was on.
  const shownPage = Math.min(page, pageCount)
  const first = (shownPage - 1) * size
  const pageRows = rows.slice(first, first + size)

  const goTo = (next: number) => setPage(Math.min(Math.max(1, next), pageCount))
  const changeSize = (next: number) => {
    setSize(next)
    setPage(1)
  }

  return (
    <Card className="w-full rounded-lg border-border/60 shadow-hairline">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4.5 py-3.25">
        <span className="flex min-w-0 items-center gap-2.25">
          <History className="size-3.25 shrink-0 text-ink-3" aria-hidden />
          <span className="text-ink-faint font-mono text-[0.6875rem] font-semibold tracking-[0.0625rem] uppercase">
            Recent transactions
          </span>
        </span>
      </div>

      <div className="border-t border-input py-1">
        <QueryState
          isPending={tokensQuery.isPending && walletQuery.isPending}
          isError={
            tokensQuery.isError && !tokensQuery.data && walletQuery.isError && !walletQuery.data
          }
          error={tokensQuery.error ?? walletQuery.error}
          onRetry={() => {
            void tokensQuery.refetch()
            void walletQuery.refetch()
          }}
          isEmpty={rows.length === 0}
          loading={
            <div className="grid gap-2 px-4.5 py-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          }
          empty={<p className="text-muted-foreground px-4.5 py-3 text-sm">No transactions yet.</p>}
        >
          <ul className="grid">
            {pageRows.map((row, index) => {
              const content = (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-6.5 shrink-0 place-items-center rounded-[0.4375rem]',
                      row.kind === 'wallet'
                        ? 'bg-success/12 text-success'
                        : 'bg-accent-ink/6 text-accent-ink'
                    )}
                  >
                    {row.kind === 'wallet' ? (
                      <Wallet className="size-3" />
                    ) : (
                      <Sparkles className="size-3" />
                    )}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-ink-strong truncate text-[0.78125rem] leading-4 font-semibold">
                      {row.title}
                    </span>
                    <span className="text-ink-3 truncate text-[0.71875rem] leading-3.5">
                      {row.sub}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'text-[0.78125rem] font-bold whitespace-nowrap tabular-nums',
                      row.kind === 'wallet' ? 'text-success-text' : 'text-foreground'
                    )}
                  >
                    {row.kind === 'wallet' ? '+' : '−'}
                    {formatRupiah(row.amount)}
                  </span>
                </>
              )
              const linkClass =
                'focus-visible:after:ring-ring/50 flex min-w-0 flex-1 items-center gap-2.5 outline-none after:absolute after:inset-0 hover:after:bg-accent/50 focus-visible:after:ring-[0.1875rem] focus-visible:after:ring-inset'
              return (
                <li key={row.key} className="relative flex items-center gap-2.5 px-4.5 py-2.25">
                  {row.checkoutUrl ? (
                    <a
                      href={row.checkoutUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Resume the payment of ${formatRupiah(row.amount)}`}
                      className={linkClass}
                    >
                      {content}
                    </a>
                  ) : row.invoiceTo && row.invoiceId ? (
                    <Link
                      to={row.invoiceTo}
                      params={{ id: row.invoiceId }}
                      aria-label={`Invoice for ${row.title}`}
                      className={linkClass}
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                  {index < pageRows.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="bg-border absolute inset-x-0 bottom-0 h-px"
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </QueryState>
      </div>

      {rows.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-t border-input px-4.5 py-2">
          <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
            {first + 1}–{first + pageRows.length} of{' '}
            {truncated ? `the newest ${rows.length}` : rows.length}
          </span>
          <Select value={String(size)} onValueChange={(value) => changeSize(Number(value))}>
            <SelectTrigger
              size="sm"
              // As quiet as the page buttons beside it: no fill until hovered or open.
              className="text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground ms-auto h-7 w-auto gap-1 border-transparent bg-transparent px-2 text-xs font-normal shadow-none"
              aria-label="Transactions per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {PAGE_SIZES.map((option) => (
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
                  disabled={shownPage === 1}
                  onClick={() => goTo(shownPage - 1)}
                >
                  <ChevronLeft className="rtl:rotate-180" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className="text-muted-foreground px-2 text-xs">
                  {shownPage} / {pageCount}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  aria-label="Next page"
                  disabled={shownPage === pageCount}
                  onClick={() => goTo(shownPage + 1)}
                >
                  <ChevronRight className="rtl:rotate-180" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  )
}
