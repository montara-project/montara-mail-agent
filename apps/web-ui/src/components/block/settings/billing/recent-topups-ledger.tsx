import { useQuery } from '@tanstack/react-query'
import { History, Sparkles, Wallet } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { monthDay } from '@/lib/date'
import { formatRupiah, formatTokens } from '@/lib/string'
import { cn } from '@/lib/utils'

/** The card shows the latest movements only; the invoice page holds the rest. */
const ROW_LIMIT = 4

type LedgerRow = {
  key: string
  at: number
  kind: 'wallet' | 'tokens'
  title: string
  sub: string
  amount: number
  paid: boolean
  /** Where the row leads: a pending payment's checkout or an invoice. */
  href?: string
  external?: boolean
}

const statusLabel: Record<Models.TokenTopup['status'], string> = {
  pending: 'Pending',
  paid: 'Paid',
  expired: 'Expired',
  failed: 'Failed',
}

/** Control Center > Billing: the wallet's recent movements — rupiah landing
 * in it and the AI tokens bought from it — the design's mixed ledger. */
export default function RecentTopupsLedger() {
  const tokensQuery = useQuery(queries.quota.topups({ offset: 0, limit: ROW_LIMIT }))
  const walletQuery = useQuery(queries.billing.walletTopups({ offset: 0, limit: ROW_LIMIT }))

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
      // has an invoice page, legacy QRIS ones included.
      href: t.status === 'pending' && t.pay_url ? t.pay_url : `/settings/billing/invoice/${t.id}`,
      external: t.status === 'pending' && !!t.pay_url,
    }))
    const walletRows = (walletQuery.data?.data ?? []).map<LedgerRow>((t) => ({
      key: `wallet-${t.id}`,
      at: new Date(t.created_at).getTime(),
      kind: 'wallet',
      title: 'Wallet top up',
      sub: `${monthDay(new Date(t.created_at), true)} · ${statusLabel[t.status]}`,
      amount: t.amount_idr,
      paid: t.status === 'paid',
      // A pending top-up's pay page is its way back to the checkout.
      href: t.status === 'pending' && t.pay_url ? t.pay_url : undefined,
      external: Boolean(t.pay_url),
    }))
    return [...tokenRows, ...walletRows].sort((a, b) => b.at - a.at).slice(0, ROW_LIMIT)
  }, [tokensQuery.data, walletQuery.data])

  return (
    <Card className="h-full w-full rounded-lg border-border/60 shadow-hairline">
      <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-[13px]">
        <span className="flex min-w-0 items-center gap-[9px]">
          <History className="size-[13px] shrink-0 text-ink-3" aria-hidden />
          <span className="text-ink-faint font-mono text-[9.5px] font-semibold tracking-[1px] uppercase">
            Recent top ups
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
            <div className="grid gap-2 px-[18px] py-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          }
          empty={<p className="text-muted-foreground px-[18px] py-3 text-sm">No top-ups yet.</p>}
        >
          <ul className="grid">
            {rows.map((row, index) => {
              const content = (
                <>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-[26px] shrink-0 place-items-center rounded-[7px]',
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
                    <span className="text-ink-strong truncate text-[11.5px] leading-4 font-semibold">
                      {row.title}
                    </span>
                    <span className="text-ink-3 truncate text-[10px] leading-[14px]">
                      {row.sub}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'text-[11.5px] font-bold whitespace-nowrap tabular-nums',
                      row.kind === 'wallet' ? 'text-success-text' : 'text-foreground'
                    )}
                  >
                    {row.kind === 'wallet' ? '+' : '−'}
                    {formatRupiah(row.amount)}
                  </span>
                </>
              )
              return (
                <li key={row.key} className="relative flex items-center gap-2.5 px-[18px] py-[9px]">
                  {row.href ? (
                    <a
                      href={row.href}
                      target={row.external ? '_blank' : undefined}
                      rel={row.external ? 'noreferrer' : undefined}
                      aria-label={
                        row.external
                          ? `Resume the payment of ${formatRupiah(row.amount)}`
                          : `Invoice for ${row.title}`
                      }
                      className="focus-visible:after:ring-ring/50 flex min-w-0 flex-1 items-center gap-2.5 outline-none after:absolute after:inset-0 hover:after:bg-accent/50 focus-visible:after:ring-[3px] focus-visible:after:ring-inset"
                    >
                      {content}
                    </a>
                  ) : (
                    content
                  )}
                  {index < rows.length - 1 && (
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
    </Card>
  )
}
