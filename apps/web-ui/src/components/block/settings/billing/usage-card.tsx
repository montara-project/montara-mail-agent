import { useQuery } from '@tanstack/react-query'
import { Gauge, RotateCcw } from 'lucide-react'

import QueryState from '@/components/block/common/query-state'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'
import { formatTokens } from '@/lib/string'
import { cn } from '@/lib/utils'

// The allowance resets weekly; the next Monday 00:00, as the design's note.
const RESET_NOTE = (() => {
  const now = new Date()
  const next = new Date(now)
  next.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7))
  next.setHours(0, 0, 0, 0)
  return `Resets ${next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · 00:00`
})()

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
        <span className="text-base leading-[22px] font-bold tracking-[-0.3px] tabular-nums">
          {shown}%
        </span>
        <span className="text-ink-3 text-[9px] leading-3">of quota</span>
      </span>
    </div>
  )
}

/** Control Center > Billing: this week's AI tokens against the plan's
 * allowance — the donut, the total, and the reset the design notes. */
export default function UsageCard() {
  const quotaQuery = useQuery(queries.quota.status())
  const { data: quota, isPending } = quotaQuery

  const used = quota?.used_tokens ?? 0
  const limit = quota?.limit_tokens ?? null
  const percent = limit ? Math.round((used / limit) * 100) : null
  const left = limit !== null ? Math.max(0, limit - used) : null
  const planLabel =
    quota?.plan === 'pro'
      ? 'Pro plan'
      : quota?.plan === 'enterprise'
        ? 'Enterprise plan'
        : 'Free plan'

  return (
    <Card className="w-full rounded-lg border-border/60 shadow-hairline">
      <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-[13px]">
        <span className="flex min-w-0 items-center gap-[9px]">
          <Gauge className="size-[13px] shrink-0 text-ink-3" aria-hidden />
          <span className="text-ink-faint font-mono text-[9.5px] font-semibold tracking-[1px] uppercase">
            AI usage · this week
          </span>
        </span>
        <span className="flex items-center gap-[5px] text-ink-3 text-[10.5px]">
          <RotateCcw className="size-[11px]" aria-hidden />
          {RESET_NOTE}
        </span>
      </div>

      <div className="border-t border-input px-[18px] py-4">
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
                className="bg-secondary text-ink-3 grid size-21 shrink-0 place-items-center rounded-full text-[10.5px]"
                aria-hidden="true"
              >
                Unlimited
              </div>
            )}

            <div className="hidden h-21 w-px bg-border sm:block" aria-hidden="true" />

            <div className="grid min-w-0 flex-1 content-center gap-[11px]">
              <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                <div className="grid gap-px">
                  <span className="text-[15px] font-bold tracking-[-0.2px] tabular-nums">
                    {formatTokens(used)} tokens
                  </span>
                  <span className="text-ink-3 text-[10.5px]">
                    {limit !== null
                      ? `of ${formatTokens(limit)} weekly cap · ${planLabel}`
                      : `No weekly cap · ${planLabel}`}
                  </span>
                </div>
                {left !== null && (
                  <span className="text-muted-foreground text-[11px] font-semibold tabular-nums">
                    {formatTokens(left)} left
                  </span>
                )}
              </div>
              {percent !== null && percent >= 100 && (
                <p className="text-destructive text-xs">
                  The weekly allowance is spent; new AI calls draw from the pay-as-you-go balance.
                </p>
              )}
            </div>
          </div>
        </QueryState>
      </div>

      <div className="border-t border-input px-[18px] py-[11px]">
        <p className="text-ink-3 text-[10.5px]">Quota refills every Monday at 00:00 UTC</p>
      </div>
    </Card>
  )
}
