import { useQuery } from '@tanstack/react-query'
import { Clock3, ExternalLink, Sparkles, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { queries } from '@/lib/api/queries'
import { clock, monthDay, timeAgo } from '@/lib/date'
import { formatRupiah, formatTokens } from '@/lib/string'

/** The server expires a checkout nobody paid after a day; every pending one is that recent. */
const PENDING_FOR_MS = 24 * 60 * 60 * 1000
/** Enough rows to hold a day of checkouts: a pending one is never older than that. */
const RECENT = { offset: 0, limit: 20 }

type Pending = {
  key: string
  kind: 'wallet' | 'tokens'
  title: string
  amount: number
  createdAt: Date
  payUrl: string
}

/**
 * Control Center > Billing: checkouts started at the payment gateway and left
 * unpaid — wallet and AI token top-ups — each with its way back to the
 * checkout and when it lapses. Hidden while there are none; it polls while
 * there are, so a payment made in the other tab clears its row.
 */
export default function PendingPayments() {
  const poll = (pending: boolean) => (pending ? 10_000 : false)
  const walletQuery = useQuery({
    ...queries.billing.walletTopups(RECENT),
    refetchInterval: (query) => poll(!!query.state.data?.data.some((t) => t.status === 'pending')),
  })
  const tokensQuery = useQuery({
    ...queries.quota.topups(RECENT),
    refetchInterval: (query) => poll(!!query.state.data?.data.some((t) => t.status === 'pending')),
  })

  const rows: Pending[] = [
    ...(walletQuery.data?.data ?? []).map((t) => ({
      key: `wallet-${t.id}`,
      kind: 'wallet' as const,
      status: t.status,
      title: 'Wallet top up',
      amount: t.amount_idr,
      createdAt: new Date(t.created_at),
      payUrl: t.pay_url,
    })),
    ...(tokensQuery.data?.data ?? []).map((t) => ({
      key: `tokens-${t.id}`,
      kind: 'tokens' as const,
      status: t.status,
      title: `AI tokens · ${formatTokens(t.tokens)}`,
      amount: t.amount_idr,
      createdAt: new Date(t.created_at),
      payUrl: t.pay_url,
    })),
  ]
    // A wallet purchase is paid at once and has no checkout to go back to.
    .filter((row) => row.status === 'pending' && row.payUrl)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  if (rows.length === 0) return null

  return (
    <section
      aria-labelledby="pending-payments-title"
      className="border-warning/30 bg-warning/8 grid gap-2.5 rounded-lg border p-4"
    >
      <div className="flex items-center gap-2">
        <Clock3 className="text-warning-text size-[13px] shrink-0" aria-hidden />
        <h2 id="pending-payments-title" className="text-[13px] leading-[18px] font-bold">
          {rows.length === 1 ? 'A payment is waiting' : `${rows.length} payments are waiting`}
        </h2>
      </div>
      <p className="text-ink-3 text-[11.5px] leading-4 text-pretty">
        Started at the BorderPay checkout but not paid yet. Finish one to get its balance; an unpaid
        checkout lapses after a day.
      </p>
      <ul className="grid gap-1.5">
        {rows.map((row) => (
          <li
            key={row.key}
            className="bg-card border-border flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[9px] border px-3 py-2.5"
          >
            <span className="bg-muted text-ink-3 grid size-[26px] shrink-0 place-items-center rounded-[7px]">
              {row.kind === 'wallet' ? (
                <Wallet className="size-3" aria-hidden />
              ) : (
                <Sparkles className="size-3" aria-hidden />
              )}
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="text-ink-strong truncate text-xs leading-4 font-semibold">
                {row.title} · <span className="tabular-nums">{formatRupiah(row.amount)}</span>
              </span>
              <span className="text-ink-3 text-[10.5px] leading-[14px]">
                Started {monthDay(row.createdAt)}, {clock(row.createdAt)} · lapses{' '}
                {timeAgo(new Date(row.createdAt.getTime() + PENDING_FOR_MS))}
              </span>
            </span>
            <Button
              asChild
              size="sm"
              className="h-7 shrink-0 text-[11.5px] font-semibold shadow-none"
            >
              <a href={row.payUrl} target="_blank" rel="noreferrer">
                <ExternalLink aria-hidden />
                Resume payment
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
