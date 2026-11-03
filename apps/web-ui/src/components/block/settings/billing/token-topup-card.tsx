import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles, Tag, Zap } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatRupiah, formatTokens } from '@/lib/string'
import { cn } from '@/lib/utils'

/** The design's rate: Rp1.000 per 1M tokens, a 10M floor in 1M steps. */
const IDR_PER_MILLION = 1_000
const MIN_MILLIONS = 10
/** The presets, in millions of tokens; the first is selected. */
const PRESETS = [10, 25, 50, 100] as const

/** Control Center > Billing: buy pay-as-you-go tokens straight from the IDR
 * wallet — the design's presets, its custom field, and its Buy button. */
export default function TokenTopUpCard() {
  const walletQuery = useQuery(queries.billing.wallet())
  const buy = useMutation(queries.quota.createTopup())

  // The selection: the custom field wins while it carries a value; otherwise
  // the pressed preset.
  const [custom, setCustom] = React.useState('')
  const [preset, setPreset] = React.useState<number>(PRESETS[0])
  const value = custom !== '' ? Number(custom) : preset
  const valid = value !== null && Number.isInteger(value) && value >= MIN_MILLIONS
  const tokens = valid ? value * 1_000_000 : 0
  const total = valid ? value * IDR_PER_MILLION : 0

  const pickPreset = (n: number) => {
    setPreset(n)
    setCustom('')
  }

  return (
    <Card className="w-full rounded-lg border-border/60 shadow-hairline">
      <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-[13px]">
        <span className="flex min-w-0 items-center gap-[9px]">
          <Sparkles className="size-[13px] shrink-0 text-ink-3" aria-hidden />
          <span className="text-ink-faint font-mono text-[9.5px] font-semibold tracking-[1px] uppercase">
            Top up AI tokens
          </span>
        </span>
        <span className="flex items-center gap-[5px] text-ink-3 text-[10.5px]">
          <Tag className="size-[11px]" aria-hidden />
          {formatRupiah(IDR_PER_MILLION)} per 1M tokens
        </span>
      </div>

      <div className="grid content-start gap-3.5 border-t border-input px-[18px] py-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((n) => {
            const selected = custom === '' && preset === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={selected}
                onClick={() => pickPreset(n)}
                className={cn(
                  'focus-visible:ring-ring/50 grid content-start gap-1 rounded-[9px] border px-3 py-2.5 text-start outline-none focus-visible:ring-[3px]',
                  selected
                    ? 'border-accent-ink/40 bg-accent-ink/6'
                    : 'border-border bg-muted hover:bg-accent'
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      'text-xs leading-4 font-bold whitespace-nowrap',
                      selected ? 'text-accent-soft dark:text-accent-ink' : 'text-foreground'
                    )}
                  >
                    {n}M tokens
                  </span>
                  {n === MIN_MILLIONS && (
                    <span
                      className={cn(
                        'rounded-[4px] px-1 py-px font-mono text-[8px] font-semibold tracking-[0.5px] uppercase',
                        selected
                          ? 'text-accent-soft dark:text-accent-ink bg-accent-ink/6'
                          : 'bg-foreground/8 text-ink-3'
                      )}
                    >
                      Min
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'font-mono text-[9.5px] font-semibold tabular-nums',
                    selected ? 'text-accent-soft dark:text-accent-ink' : 'text-ink-3'
                  )}
                >
                  {formatRupiah(n * IDR_PER_MILLION)}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="border-border bg-background flex w-[276px] max-w-full items-center gap-1.5 rounded-[8px] border px-[11px] py-2">
            <label htmlFor="token-topup-custom" className="sr-only">
              Custom amount in millions of tokens
            </label>
            <span className="text-ink-faint text-[11px]" aria-hidden="true">
              Custom
            </span>
            <input
              id="token-topup-custom"
              type="number"
              inputMode="numeric"
              min={MIN_MILLIONS}
              step={1}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={String(preset)}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs font-bold tabular-nums outline-none placeholder:text-ink-3 pointer-coarse:text-base"
            />
            <span className="text-muted-foreground text-[11px] font-medium whitespace-nowrap">
              M tokens
            </span>
          </div>
          <p className="text-ink-3 text-[10.5px]">Min. 10M tokens = Rp10.000 · steps of 1M</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-input px-[18px] py-[11px]">
        <p className="text-ink-3 text-[10.5px]">
          Paid from wallet ·{' '}
          {walletQuery.data ? (
            <span className="tabular-nums">{formatRupiah(walletQuery.data.balance_idr)}</span>
          ) : (
            <Skeleton className="inline-block h-3.5 w-16 align-middle" />
          )}{' '}
          available
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-baseline gap-[5px]">
            <span className="text-ink-3 text-[10.5px]">Total</span>
            <span className="text-[13px] font-bold tabular-nums">
              {valid ? formatRupiah(total) : '–'}
            </span>
          </span>
          <Button
            size="sm"
            // Dark text: white on the accent is 3.4:1, short of AA.
            className="bg-accent-ink hover:bg-accent-ink/90 h-[27px] gap-[5px] rounded-[7px] px-[11px] text-[11px] font-bold text-[#0a0a0a] shadow-none"
            disabled={!valid || buy.isPending}
            onClick={() => valid && buy.mutate({ tokens }, { onError: toastAxiosError })}
          >
            <Zap className="size-[11px]" aria-hidden />
            {buy.isPending ? 'Buying…' : `Buy ${formatTokens(tokens)} tokens`}
          </Button>
        </div>
      </div>
    </Card>
  )
}
