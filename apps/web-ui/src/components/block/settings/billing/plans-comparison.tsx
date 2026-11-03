import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { monthDay } from '@/lib/date'
import { formatRupiah } from '@/lib/string'
import { cn } from '@/lib/utils'

/** Enterprise contacts the team instead of checking out. */
const CONTACT_EMAIL = 'hello@montaramail.web.id'

/** When a new checkout replaces a pending one; the server's abandonedCheckoutAge. */
const ABANDONED_CHECKOUT_MS = 2 * 60 * 60 * 1000

/** What each tier carries, in the design's words. */
const FEATURES = {
  free: [
    'Up to 20 connected accounts',
    'Up to 2 organizations',
    '10M AI tokens a week',
    'Top-up balance (pay-as-you-go)',
    'Email support (working hours)',
  ],
  pro: [
    'Unlimited connected accounts',
    '10 organizations',
    '100M AI tokens a week',
    'Top-up balance (pay-as-you-go)',
    'Email support 24/7',
  ],
  enterprise: [
    'Unlimited connected accounts',
    'Unlimited organizations',
    'Unlimited AI tokens',
    'Dedicated support',
    'SSO + SCIM provisioning',
  ],
}

/** The discount that is running right now, if any. */
const isDiscounted = (plan: Models.BillingPlan) =>
  plan.discount_amount > 0 &&
  (!plan.discount_ends_at || new Date(plan.discount_ends_at) > new Date())

/** A pending checkout still blocks a new one; an abandoned one gets replaced. */
const checkoutInProgress = (subscription: Models.Subscription) =>
  subscription.status === 'pending' &&
  Date.now() - new Date(subscription.created_at).getTime() < ABANDONED_CHECKOUT_MS

/**
 * One tier: what it costs and its action above the line, what it carries below.
 * Two subgrid rows, so the line sits at the same height on all three. The
 * recommended tier takes the accent bar and tint; the current one a ring.
 */
function Tier({
  name,
  badge,
  price,
  unit,
  note,
  tagline,
  features,
  highlight,
  current,
  action,
}: {
  name: string
  badge?: string
  price?: string
  unit?: string
  note?: React.ReactNode
  tagline: string
  features: string[]
  highlight?: boolean
  current?: boolean
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'row-span-2 relative grid grid-rows-subgrid gap-0 overflow-hidden rounded-lg border',
        highlight ? 'border-accent-ink/40 bg-accent-tint' : 'border-border bg-inset',
        current && 'ring-accent-ink/40 ring-1'
      )}
    >
      {highlight && (
        <span aria-hidden="true" className="bg-accent-ink absolute inset-x-0 top-0 h-0.5" />
      )}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{name}</h3>
          {badge && (
            <span className="bg-accent-tint border-accent-ink/40 rounded-[4px] border px-1.5 py-0.5 font-mono text-[8px] font-semibold tracking-[0.5px] text-accent-soft uppercase">
              {badge}
              <span className="sr-only">tier</span>
            </span>
          )}
        </div>
        <div className="grid gap-[3px]">
          <div className="flex flex-wrap items-baseline gap-x-[5px]">
            <span className="text-[26px] font-bold tracking-[-0.6px] tabular-nums">{price}</span>
            {unit && <span className="text-ink-3 text-[11px]">{unit}</span>}
          </div>
          {note}
        </div>
        <p className="text-ink-3 text-[11.5px]">{tagline}</p>
        {action && (
          <div className="mt-auto *:h-9 *:w-full *:rounded-[8px] *:text-[11.5px] *:font-semibold">
            {action}
          </div>
        )}
      </div>

      <div className="grid content-start gap-2 border-t border-border px-4 pt-3.5 pb-4">
        <ul className="grid gap-2">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check
                className={cn(
                  'mt-px size-2.5 shrink-0',
                  highlight ? 'text-accent-ink' : 'text-success'
                )}
                strokeWidth={3}
                aria-hidden
              />
              <span className="text-muted-foreground text-[11px]">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function PlansComparison() {
  const plansQuery = useQuery(queries.billing.plans())
  const { data: quota } = useQuery(queries.quota.status())
  const { data: subscription } = useQuery(queries.billing.subscription())
  const plans = plansQuery.data ?? []
  const monthly = plans.find((p) => p.code === 'pro_monthly')
  const yearly = plans.find((p) => p.code === 'pro_yearly')
  const [billing, setBilling] = React.useState<'month' | 'year'>('year')
  const selected = billing === 'month' ? monthly : yearly

  const checkout = useMutation(queries.billing.checkout())
  const [paying, setPaying] = React.useState<Models.Subscription | null>(null)
  const [payOpen, setPayOpen] = React.useState(false)
  const payLink = React.useRef<HTMLAnchorElement>(null)

  const upgrade = (code: string) =>
    checkout.mutate(
      { plan_code: code },
      {
        onError: toastAxiosError,
        onSuccess: (sub) => {
          setPaying(sub)
          setPayOpen(true)
        },
      }
    )

  // Yearly reads as a monthly equivalent, with the struck full rate beside it.
  const discounted = selected ? isDiscounted(selected) : false
  const monthlyRate = monthly ? monthly.amount : null
  // The price the checkout actually charges, the plan's amount minus its live discount.
  const effective = selected ? selected.amount - (discounted ? selected.discount_amount : 0) : null
  const saving =
    yearly && isDiscounted(yearly) ? Math.round((yearly.discount_amount / yearly.amount) * 100) : 0

  const currentPlanButton = (
    <Button
      variant="secondary"
      disabled
      className="border-border bg-muted text-muted-foreground border shadow-none disabled:opacity-100"
    >
      Current plan
    </Button>
  )

  let proAction: React.ReactNode
  if (quota?.plan === 'pro') proAction = currentPlanButton
  else if (subscription && checkoutInProgress(subscription))
    proAction = <Button disabled>Payment pending</Button>
  else if (quota?.plan !== 'enterprise')
    proAction = (
      <Button
        className="border-accent-ink/25 border"
        disabled={!selected || checkout.isPending}
        onClick={() => selected && upgrade(selected.code)}
      >
        {checkout.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Upgrade to Pro
      </Button>
    )

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3" id="billing-plans">
        <span className="text-ink-faint font-mono text-[9.5px] font-semibold tracking-[1px] uppercase">
          Plans
        </span>
        {monthly && yearly && (
          <div className="border-border bg-muted flex items-center gap-0.5 rounded-[8px] border p-0.5">
            {(['month', 'year'] as const).map((value) => {
              const active = billing === value
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBilling(value)}
                  className={cn(
                    'focus-visible:ring-ring/50 flex items-center gap-[5px] rounded-[6px] px-[9px] py-1 text-[11px] whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]',
                    active
                      ? 'text-accent-soft dark:text-accent-ink bg-accent-ink/6 font-bold'
                      : 'text-ink-3 hover:text-foreground font-medium'
                  )}
                >
                  {value === 'month' ? 'Monthly' : 'Yearly'}
                  {value === 'year' && saving > 0 && (
                    <span className="text-accent-soft dark:text-accent-ink bg-accent-ink/6 rounded-[4px] px-1 py-px font-mono text-[8.5px] font-semibold">
                      −{saving}%
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <QueryState
        isPending={plansQuery.isPending}
        isError={plansQuery.isError && !plansQuery.data}
        error={plansQuery.error}
        onRetry={() => void plansQuery.refetch()}
        isEmpty={false}
        loading={<Skeleton className="h-96 w-full" />}
        empty={null}
      >
        {/* Measured on the card, not the viewport: the sidebar takes a varying share of it. */}
        <div className="@container">
          <div className="grid auto-rows-auto gap-4 @3xl:grid-cols-3">
            <Tier
              name="Free"
              price={formatRupiah(0)}
              unit="/mo"
              tagline="The essentials for trying the agent."
              features={FEATURES.free}
              current={quota?.plan === 'free'}
              action={quota?.plan === 'free' ? currentPlanButton : undefined}
            />
            <Tier
              name="Pro"
              badge={quota?.plan === 'pro' ? undefined : 'Recommended'}
              highlight={quota?.plan !== 'pro'}
              price={
                effective !== null
                  ? formatRupiah(billing === 'year' ? Math.round(effective / 12) : effective)
                  : undefined
              }
              unit="/mo"
              note={
                selected &&
                discounted && (
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="text-muted-foreground text-[11.5px] font-medium line-through tabular-nums">
                      {formatRupiah(
                        billing === 'year' ? (monthlyRate ?? selected.amount) : selected.amount
                      )}
                    </span>
                    <span className="text-success-ink text-[11px] font-semibold">
                      Save {formatRupiah(selected.discount_amount)}
                      {selected.discount_ends_at
                        ? ` until ${monthDay(new Date(selected.discount_ends_at), true)}`
                        : ''}
                    </span>
                  </p>
                )
              }
              tagline="For teams who live in their inbox."
              features={FEATURES.pro}
              current={quota?.plan === 'pro'}
              action={proAction}
            />
            <Tier
              name="Enterprise"
              price="Custom"
              tagline="Unlimited everything, billed per contract."
              features={FEATURES.enterprise}
              current={quota?.plan === 'enterprise'}
              action={
                quota?.plan === 'enterprise' ? (
                  currentPlanButton
                ) : (
                  <Button
                    variant="secondary"
                    className="border-border border bg-black text-white hover:bg-black/90"
                    asChild
                  >
                    <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
                  </Button>
                )
              }
            />
          </div>
        </div>
      </QueryState>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        {/* Kept after closing, so the dialog doesn't empty while it animates out. */}
        {paying && (
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
                <DialogTitle>Complete your upgrade</DialogTitle>
                <DialogDescription>
                  Scan the QRIS or pay at the BorderPay checkout.
                </DialogDescription>
              </div>
              <dl className="divide-y border-y text-sm">
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="text-muted-foreground">Plan</dt>
                  <dd>
                    {paying.plan_name}, {paying.billing_interval === 'year' ? 'yearly' : 'monthly'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-2.5">
                  <dt className="font-medium">Total</dt>
                  <dd className="text-base font-semibold tabular-nums">
                    {formatRupiah(paying.amount)}
                  </dd>
                </div>
              </dl>
              <p className="text-muted-foreground text-xs leading-5">
                The plan activates when the payment lands, usually within seconds.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t p-4">
              <Button variant="outline" onClick={() => setPayOpen(false)}>
                Done
              </Button>
              <Button asChild>
                <a ref={payLink} href={paying.pay_url} target="_blank" rel="noreferrer">
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
