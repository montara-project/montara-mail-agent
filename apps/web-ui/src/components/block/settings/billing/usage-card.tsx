import { useQuery } from '@tanstack/react-query'
import { Gauge, RotateCcw } from 'lucide-react'

import QueryState from '@/components/block/common/query-state'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { clock } from '@/lib/date'
import { formatTokens } from '@/lib/string'
import { cn } from '@/lib/utils'

/**
 * When the allowance resets: the server's week starts Monday 00:00 UTC, shown
 * in the reader's own time (07:00 in Jakarta), so the day and hour are the
 * real ones wherever they are.
 */
function resetNote(now: Date) {
  const next = new Date(now)
  next.setUTCDate(now.getUTCDate() + ((8 - now.getUTCDay()) % 7 || 7))
  next.setUTCHours(0, 0, 0, 0)
  return `Resets ${next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${clock(next)}`
}

/** The week's spend as the design's 84px donut: a track, a fill, and the
 * percentage it leaves no doubt about. Decorative — the numbers sit beside it. */
function UsageRing({ percent }: { percent: number }) {
  const stroke = 6
  const r = (84 - stroke) / 2
  const circumference = 2 * Math.PI * r
  const shown = Math.min(100, Math.max(0, percent))

  return (
    <div className="relative size-21 shrink-0" aria-hidden="true">
      <svg viewBox="0 0 84 84" className="size-full -rotate-90">
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-secondary"
        />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          className={cn(
            'transition-[stroke-dashoffset]',
            percent >= 100 ? 'stroke-destructive' : 'stroke-accent-ink'
          )}
        />
      </svg>
      <span className="absolute inset-0 grid content-center justify-items-center gap-px">
        <span className="text-base leading-[1.375rem] font-bold tracking-[-0.01875rem] tabular-nums">
          {shown}%
        </span>
        <span className="text-ink-3 text-[0.6875rem] leading-3">of quota</span>
      </span>
    </div>
  )
}

/**
 * One source of tokens, as the design's metric rows: its name and a note in
 * mono, a bar of how much of it is gone, and what is left.
 */
function SourceRow({
  label,
  note,
  percent,
  bar,
  value,
}: {
  label: string
  note: string
  /** Of this source, used; null draws no bar (unlimited). */
  percent: number | null
  /** The bar's hue, which matches the source's name in the total line. */
  bar: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid w-28 shrink-0 gap-px">
        <span className="text-muted-foreground text-[0.71875rem] leading-[0.875rem] font-medium">
          {label}
        </span>
        <span className="text-ink-faint font-mono text-[0.6875rem] leading-[0.6875rem] font-semibold">
          {note}
        </span>
      </div>
      <div
        className="bg-secondary h-1 min-w-0 flex-1 overflow-hidden rounded-[0.125rem]"
        aria-hidden="true"
      >
        {percent !== null && (
          <div
            className={cn('h-full rounded-[0.125rem]', bar)}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        )}
      </div>
      <span className="text-ink-strong min-w-16 shrink-0 text-end text-[0.75rem] font-semibold tabular-nums">
        {value}
      </span>
    </div>
  )
}

/** Control Center > Billing: this week's AI tokens against the plan's
 * allowance — the donut, the total, and the reset the design notes — then the
 * plan's allowance and the bought (pay-as-you-go) tokens as separate rows,
 * since calls spend the allowance first and the bought tokens after. */
export default function UsageCard() {
  const quotaQuery = useQuery(queries.quota.status())
  const { data: quota, isPending } = quotaQuery

  const used = quota?.used_tokens ?? 0
  const limit = quota?.limit_tokens ?? null
  const percent = limit ? Math.round((used / limit) * 100) : null
  const left = limit !== null ? Math.max(0, limit - used) : null
  // Bought tokens: what AI calls draw from once the weekly allowance is spent,
  // never expiring. This week's draw from them is whatever ran past the cap.
  const payg = quota?.payg_balance_tokens ?? 0
  const planUsed = limit !== null ? Math.min(used, limit) : used
  const paygUsed = limit !== null ? Math.max(0, used - limit) : 0
  const planLabel =
    quota?.plan === 'pro'
      ? 'Pro plan'
      : quota?.plan === 'enterprise'
        ? 'Enterprise plan'
        : 'Free plan'

  return (
    <Card className="w-full rounded-lg border-border/60 shadow-hairline">
      <div className="flex flex-wrap items-center justify-between gap-2 px-[1.125rem] py-[0.8125rem]">
        <span className="flex min-w-0 items-center gap-[0.5625rem]">
          <Gauge className="size-[0.8125rem] shrink-0 text-ink-3" aria-hidden />
          <span className="text-ink-faint font-mono text-[0.6875rem] font-semibold tracking-[0.0625rem] uppercase">
            AI usage · this week
          </span>
        </span>
        <span className="flex items-center gap-[0.3125rem] text-ink-3 text-[0.71875rem]">
          <RotateCcw className="size-[0.6875rem]" aria-hidden />
          {/* From the last fetch's time: render stays pure, and the poll keeps it current. */}
          {quotaQuery.dataUpdatedAt > 0 && resetNote(new Date(quotaQuery.dataUpdatedAt))}
        </span>
      </div>

      <div className="border-t border-input px-[1.125rem] py-4">
        <QueryState
          isPending={isPending}
          isError={quotaQuery.isError && !quota}
          error={quotaQuery.error}
          onRetry={() => void quotaQuery.refetch()}
          isEmpty={false}
          loading={<Skeleton className="h-21 w-full" />}
          empty={null}
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
            {/* The ring and the numbers, split by the design's rule. */}
            {limit !== null && percent !== null && <UsageRing percent={percent} />}
            {limit === null && (
              <div
                className="bg-secondary text-ink-3 grid size-21 shrink-0 place-items-center rounded-full text-[0.71875rem]"
                aria-hidden="true"
              >
                Unlimited
              </div>
            )}

            <div className="hidden h-21 w-px bg-border sm:block" aria-hidden="true" />

            <div className="grid min-w-0 flex-1 content-center gap-[0.6875rem]">
              <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                <div className="grid gap-px">
                  <span className="text-[1rem] font-bold tracking-[-0.0125rem] tabular-nums">
                    {formatTokens(used)} tokens
                  </span>
                  <span className="text-ink-3 text-[0.71875rem]">
                    {limit !== null
                      ? `used this week · the plan's ${formatTokens(limit)} first, then top-up tokens`
                      : `used this week · No weekly cap · ${planLabel}`}
                  </span>
                </div>
                {left !== null && (
                  <span className="text-muted-foreground text-[0.75rem] font-semibold tabular-nums">
                    {formatTokens(left + payg)} available
                  </span>
                )}
              </div>
              <SourceRow
                label="Plan allowance"
                note={`${planLabel} · weekly`}
                percent={percent}
                bar="bg-accent-ink"
                value={
                  limit !== null
                    ? `${formatTokens(planUsed)} / ${formatTokens(limit)}`
                    : `${formatTokens(planUsed)} used`
                }
              />
              {limit !== null && (
                <SourceRow
                  label="Top-up (PAYG)"
                  note={paygUsed > 0 ? `${formatTokens(paygUsed)} used this week` : 'never expires'}
                  percent={payg + paygUsed > 0 ? (paygUsed / (payg + paygUsed)) * 100 : 0}
                  bar="bg-info"
                  value={`${formatTokens(payg)} left`}
                />
              )}
              {percent !== null && percent >= 100 && (
                <p className="text-destructive text-xs">
                  The weekly allowance is spent; new AI calls draw from the pay-as-you-go balance.
                </p>
              )}
            </div>
          </div>
        </QueryState>
      </div>

      <div className="border-t border-input px-[1.125rem] py-[0.6875rem]">
        <p className="text-ink-3 text-[0.71875rem]">Quota refills every Monday at 00:00 UTC</p>
      </div>
    </Card>
  )
}
