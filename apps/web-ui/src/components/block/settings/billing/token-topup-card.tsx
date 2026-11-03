import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2, QrCode, Sparkles, Tag, Wallet, Zap } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import { NumberInput } from '@/components/block/common/number-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatRupiah } from '@/lib/string'
import { cn } from '@/lib/utils'

/** The design's rate: Rp1.000 per 1M tokens, a 10M floor in 1M steps. */
const IDR_PER_MILLION = 1_000
const MIN_MILLIONS = 10
/** The presets, in millions of tokens; the first is selected. */
const PRESETS = [10, 25, 50, 100] as const

/**
 * A count of millions, exact and grouped like the rupiah beside it: 1.234M.
 * formatTokens rounds past 999M (1,234M reads as 1.2B), which misstates what is bought.
 */
const millions = (n: number) => `${n.toLocaleString('id-ID')}M`

type Method = 'wallet' | 'gateway'

/**
 * How to pay for a purchase: the wallet, at once, when its balance covers the
 * total; or BorderPay's QRIS checkout, which credits the tokens once paid.
 * A gateway purchase ends on its checkout link.
 */
function PayDialog({
  tokens,
  total,
  open,
  onOpenChange,
  onPaid,
}: {
  /** In millions, as the card counts them. */
  tokens: number
  total: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaid: () => void
}) {
  const walletQuery = useQuery(queries.billing.wallet())
  const buy = useMutation(queries.quota.createTopup())
  const balance = walletQuery.data?.balance_idr
  const covered = balance !== undefined && balance >= total
  const [method, setMethod] = React.useState<Method>('wallet')
  // A wallet that can't cover the total leaves the gateway as the only way.
  const chosen: Method =
    method === 'wallet' && balance !== undefined && !covered ? 'gateway' : method
  const [checkout, setCheckout] = React.useState<string | null>(null)
  const payLink = React.useRef<HTMLAnchorElement>(null)

  const close = () => {
    onOpenChange(false)
    setCheckout(null)
  }

  const pay = () =>
    buy.mutate(
      { tokens: tokens * 1_000_000, method: chosen },
      {
        onSuccess: (result) => {
          onPaid()
          if (result.pay_url) {
            setCheckout(result.pay_url)
            return
          }
          // The wallet, the balance and the ledger refetch through the mutation's invalidations.
          toast.success(`${millions(tokens)} tokens added to your balance`)
          close()
        },
        onError: toastAxiosError,
      }
    )

  const options: {
    value: Method
    icon: typeof Wallet
    title: string
    note: string
    disabled?: boolean
  }[] = [
    {
      value: 'wallet',
      icon: Wallet,
      title: 'Wallet balance',
      note:
        balance === undefined
          ? 'Loading the balance…'
          : covered
            ? `${formatRupiah(balance)} available · ${formatRupiah(balance - total)} left after`
            : `${formatRupiah(balance)} available · not enough, top up the wallet first`,
      disabled: !covered,
    },
    {
      value: 'gateway',
      icon: QrCode,
      title: 'QRIS via BorderPay',
      note: 'Scan to pay; the tokens land once the payment does.',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <div className="grid gap-4 p-6">
          <div className="grid gap-1.5 pe-8">
            <DialogTitle>
              {checkout ? 'Complete your purchase' : `Buy ${millions(tokens)} tokens`}
            </DialogTitle>
            <DialogDescription>
              {checkout
                ? 'Scan the QRIS or pay at the BorderPay checkout. The tokens land in your balance once it is paid.'
                : `${formatRupiah(total)} at ${formatRupiah(IDR_PER_MILLION)} per 1M tokens. Choose how to pay.`}
            </DialogDescription>
          </div>
          {!checkout && (
            <div role="radiogroup" aria-label="Payment method" className="grid gap-2">
              {options.map((option) => (
                // The title inside names the radio; the rule can't see text that comes from a variable.
                // oxlint-disable-next-line jsx-a11y/label-has-associated-control
                <label
                  key={option.value}
                  className={cn(
                    'has-[:focus-visible]:ring-ring/50 flex items-start gap-3 rounded-[9px] border px-3 py-2.5 has-[:focus-visible]:ring-[3px]',
                    chosen === option.value
                      ? 'border-accent-ink/40 bg-accent-ink/6'
                      : 'border-border',
                    option.disabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-accent/50 cursor-pointer'
                  )}
                >
                  <input
                    type="radio"
                    name="token-payment"
                    value={option.value}
                    checked={chosen === option.value}
                    disabled={option.disabled}
                    onChange={() => setMethod(option.value)}
                    className="accent-accent-ink mt-0.5 size-3.5 shrink-0"
                  />
                  <option.icon className="text-ink-3 mt-px size-4 shrink-0" aria-hidden />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="text-[12.5px] leading-[17px] font-semibold">
                      {option.title}
                    </span>
                    <span className="text-ink-3 text-[11px] leading-[15px] tabular-nums">
                      {option.note}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t p-4">
          {checkout ? (
            <>
              <Button variant="outline" onClick={close}>
                Done
              </Button>
              <Button asChild>
                {/* autoFocus: Radix skips links when it picks the first focus. */}
                <a ref={payLink} href={checkout} target="_blank" rel="noreferrer" autoFocus>
                  <ExternalLink aria-hidden />
                  Open the payment page
                </a>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button disabled={buy.isPending || balance === undefined} onClick={pay}>
                {buy.isPending && <Loader2 className="animate-spin" aria-hidden />}
                {chosen === 'wallet' ? `Pay ${formatRupiah(total)}` : 'Continue to payment'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Control Center > Billing: buy pay-as-you-go tokens from the IDR wallet or
 * through the gateway — the design's presets, its custom field, and its Buy button. */
export default function TokenTopUpCard() {
  const walletQuery = useQuery(queries.billing.wallet())
  const [paying, setPaying] = React.useState(false)

  // The selection: the custom field wins while it carries a value; otherwise
  // the pressed preset.
  const [custom, setCustom] = React.useState('')
  const [preset, setPreset] = React.useState<number>(PRESETS[0])
  const value = custom !== '' ? Number(custom) : preset
  const valid = value !== null && Number.isInteger(value) && value >= MIN_MILLIONS
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
            <NumberInput
              id="token-topup-custom"
              decimalScale={0}
              thousandSeparator="."
              decimalSeparator=","
              allowNegative={false}
              value={custom}
              onValueChange={setCustom}
              placeholder={String(preset)}
              className="h-auto min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-xs font-bold shadow-none placeholder:text-ink-3 focus-visible:ring-0"
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
          Wallet ·{' '}
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
            disabled={!valid}
            onClick={() => setPaying(true)}
          >
            <Zap className="size-[11px]" aria-hidden />
            {`Buy ${millions(value)} tokens`}
          </Button>
        </div>
      </div>
      {valid && (
        <PayDialog
          tokens={value}
          total={total}
          open={paying}
          onOpenChange={setPaying}
          onPaid={() => setCustom('')}
        />
      )}
    </Card>
  )
}
