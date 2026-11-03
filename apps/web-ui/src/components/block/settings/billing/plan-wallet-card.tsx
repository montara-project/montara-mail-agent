import { useMutation, useQuery } from '@tanstack/react-query'
import { CreditCard, ExternalLink, Loader2, Plus, Wallet } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import { NumberInput } from '@/components/block/common/number-input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { elapsedPercent, isPast, monthDay } from '@/lib/date'
import { formatRupiah } from '@/lib/string'

import TopupStatusBadge from './topup-status-badge'

/** The smallest top-up; the amount is otherwise free-form rupiah. */
const MIN_TOPUP_IDR = 10_000

/** The tier's display name, the pricing page's words. */
function planName(plan: string, unlimited: boolean) {
  if (plan === 'pro') return 'Pro'
  if (plan === 'enterprise') return 'Enterprise'
  return plan === 'free' && !unlimited ? 'Free' : 'Unlimited'
}

/** The green dot badge the design puts at the card's top right. */
function ActiveBadge() {
  return (
    <span className="flex items-center gap-[5px] rounded-[5px] bg-success/12 px-[7px] py-[3px] text-[10.5px] font-semibold text-success-text">
      <span className="size-[5px] rounded-full bg-success" aria-hidden />
      Active
    </span>
  )
}

/** Control Center > Billing: one card for the subscription and the wallet it
 * renews from — the tier, its price and period, the balance, and the actions. */
export default function PlanWalletCard() {
  const quotaQuery = useQuery(queries.quota.status())
  const subscriptionQuery = useQuery(queries.billing.subscription())
  const walletQuery = useQuery(queries.billing.wallet())
  const plansQuery = useQuery(queries.billing.plans())
  const securityQuery = useQuery(queries.profile.security())
  const autoRenew = useMutation(queries.billing.autoRenew())
  const topup = useMutation(queries.billing.walletTopup())

  const { data: quota, refetch: refetchQuota } = quotaQuery
  const sub = subscriptionQuery.data ?? null
  const pending = sub?.status === 'pending'
  const active = sub?.status === 'active'
  const superUser = securityQuery.data?.super_user ?? false

  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [checkout, setCheckout] = React.useState<Models.WalletTopup | null>(null)
  const payLink = React.useRef<HTMLAnchorElement>(null)

  const value = Number(amount)
  const valid = Number.isInteger(value) && value >= MIN_TOPUP_IDR

  // A pending checkout turning active changes the tier and its allowance.
  React.useEffect(() => {
    if (active) void refetchQuota()
  }, [active, refetchQuota])

  const startTopup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || topup.isPending) return
    topup.mutate(
      { amount_idr: value },
      {
        onError: toastAxiosError,
        onSuccess: (t) => {
          setCheckout(t)
          setOpen(false)
          setAmount('')
        },
      }
    )
  }

  const closeCheckout = () => {
    setCheckout(null)
    void walletQuery.refetch()
  }

  // The tier line: the live plan, or a pending checkout's target while paying.
  const name = quota
    ? planName(quota.plan, quota.limit_tokens === null)
    : pending
      ? sub.plan_name
      : null

  // The card's cycle chip: the interval plus the discount that makes it, if any.
  const yearly = plansQuery.data?.find((p) => p.code === 'pro_yearly')
  const discountPercent =
    yearly &&
    yearly.discount_amount > 0 &&
    (!yearly.discount_ends_at || !isPast(new Date(yearly.discount_ends_at)))
      ? Math.round((yearly.discount_amount / yearly.amount) * 100)
      : 0

  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null
  const periodStart = sub?.current_period_start ? new Date(sub.current_period_start) : null
  // How much of the paid period has run; the bar beside the note.
  const periodPercent =
    periodStart && periodEnd && periodEnd > periodStart
      ? elapsedPercent(periodStart, periodEnd)
      : null

  // Yearly amounts read as a monthly equivalent, the pricing page's way.
  const price =
    active && sub
      ? formatRupiah(sub.billing_interval === 'year' ? Math.round(sub.amount / 12) : sub.amount)
      : quota?.plan === 'free'
        ? formatRupiah(0)
        : quota?.plan === 'enterprise'
          ? 'Custom'
          : null

  const footNote = pending
    ? 'Complete the payment to activate the plan.'
    : active && sub
      ? sub.auto_renew
        ? 'Auto-debits from wallet at the end of each period'
        : `Auto-renew is off · the plan ends ${periodEnd ? monthDay(periodEnd, true) : '–'}`
      : 'The wallet funds pay-as-you-go tokens and plan renewals.'

  return (
    <>
      <Card className="w-full rounded-lg border-border/60 shadow-hairline">
        <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-[13px]">
          <span className="flex min-w-0 items-center gap-[9px]">
            <CreditCard className="size-[13px] shrink-0 text-ink-3" aria-hidden />
            <span className="text-ink-faint font-mono text-[9.5px] font-semibold tracking-[1px] uppercase">
              Subscription &amp; wallet
            </span>
          </span>
          {active && <ActiveBadge />}
        </div>

        <div className="grid items-center gap-5 border-t border-input px-[18px] py-4 sm:grid-cols-[minmax(0,1fr)_1px_minmax(10rem,190px)]">
          <div className="grid content-start gap-[7px]">
            {name === null ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[17px] font-bold tracking-[-0.2px]">{name}</span>
                {active && sub?.billing_interval && (
                  <span className="text-accent-soft dark:text-accent-ink rounded-[4px] bg-accent-ink/6 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold tracking-[0.5px] uppercase">
                    {sub.billing_interval === 'year' ? 'Yearly' : 'Monthly'}
                    {discountPercent > 0 && <span> · −{discountPercent}%</span>}
                  </span>
                )}
              </div>
            )}

            {pending && sub ? (
              <div className="grid gap-2">
                <p className="text-ink-3 text-sm">
                  Checkout for the {sub.plan_name} plan,{' '}
                  {sub.billing_interval === 'year' ? 'yearly' : 'monthly'} ·{' '}
                  <span className="tabular-nums">{formatRupiah(sub.amount)}</span>
                </p>
                <Button size="sm" className="w-fit" asChild>
                  <a href={sub.pay_url} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden />
                    Finish the payment
                  </a>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-[5px] gap-y-0.5">
                {price === null ? (
                  <Skeleton className="h-5 w-28" />
                ) : (
                  <>
                    <span className="text-[15px] font-bold tabular-nums">{price}</span>
                    <span className="text-ink-3 text-[11px]">
                      {price === 'Custom'
                        ? ''
                        : active && sub
                          ? `/mo · ${sub.auto_renew ? 'renews' : 'ends'} ${periodEnd ? monthDay(periodEnd, true) : '–'}`
                          : '/mo'}
                    </span>
                  </>
                )}
              </div>
            )}

            {active && periodPercent !== null && (
              <div className="grid gap-[5px]">
                <div aria-hidden="true" className="bg-secondary h-1 overflow-hidden rounded-[2px]">
                  <div
                    className="bg-accent-ink h-full rounded-[2px]"
                    style={{ width: `${periodPercent}%` }}
                  />
                </div>
                <p className="text-ink-3 text-[10.5px] tabular-nums">
                  Billing period {periodPercent}% used
                  {sub?.auto_renew && sub.amount > 0 && (
                    <span> · next invoice {formatRupiah(sub.amount)}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {!superUser && <div className="hidden h-[72px] bg-border sm:block" aria-hidden="true" />}

          {!superUser && (
            <div className="grid content-start gap-[7px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink-faint font-mono text-[9px] font-semibold tracking-[1px] uppercase">
                  Wallet
                </span>
                <Wallet className="size-3 text-ink-3" aria-hidden />
              </div>
              {walletQuery.data ? (
                <span className="text-[15px] font-bold tabular-nums">
                  {formatRupiah(walletQuery.data.balance_idr)}
                </span>
              ) : (
                <Skeleton className="h-5 w-24" />
              )}
              <Button
                size="xs"
                variant="secondary"
                className="h-[27px] gap-[5px] rounded-[7px] border border-border bg-muted px-[11px] text-[11px] font-semibold shadow-none w-full"
                onClick={() => setOpen(true)}
              >
                <Plus className="size-[11px]" aria-hidden />
                Top up
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-input px-[18px] py-[11px]">
          <p className="text-ink-3 text-[10.5px]">{footNote}</p>
          <div className="flex items-center gap-2">
            {!superUser && (
              <Button
                size="xs"
                variant="secondary"
                className="h-[27px] gap-[5px] rounded-[7px] border border-border bg-muted px-[11px] text-[11px] font-semibold shadow-none"
                asChild
              >
                <a href="#billing-plans">Manage plan</a>
              </Button>
            )}
            {active && sub?.auto_renew && (
              <Button
                size="xs"
                variant="dim"
                className="h-[27px] px-[11px] text-[11px] font-medium"
                disabled={autoRenew.isPending}
                onClick={() =>
                  autoRenew.mutate(
                    { enabled: false },
                    {
                      onError: toastAxiosError,
                      // The tier keeps running until the period ends; the quota
                      // unchanged, but the wallet stops being reserved.
                      onSuccess: () => void subscriptionQuery.refetch(),
                    }
                  )
                }
              >
                {autoRenew.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Cancel plan
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setAmount('')
        }}
      >
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <form onSubmit={startTopup}>
            <div className="grid gap-4 p-6">
              <div className="grid gap-1.5 pe-8">
                <DialogTitle>Top up your wallet</DialogTitle>
                <DialogDescription>
                  Add rupiah to the balance your subscription renews from. The smallest top-up is
                  Rp10.000.
                </DialogDescription>
              </div>
              <Field>
                <FieldLabel htmlFor="wallet-topup-amount">Amount in rupiah</FieldLabel>
                <NumberInput
                  id="wallet-topup-amount"
                  prefix="Rp"
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={0}
                  allowNegative={false}
                  value={amount}
                  onValueChange={setAmount}
                  placeholder="Rp10.000"
                />
                <FieldDescription>You will be taken to BorderPay's QRIS checkout.</FieldDescription>
              </Field>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t p-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={topup.isPending || !valid}>
                {topup.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Continue to payment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!checkout} onOpenChange={(v) => !v && closeCheckout()}>
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
                  <dd className="text-muted-foreground flex items-center gap-2">
                    {monthDay(new Date(checkout.created_at), true)}
                    <TopupStatusBadge status={checkout.status} />
                  </dd>
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
                seconds.
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
    </>
  )
}
