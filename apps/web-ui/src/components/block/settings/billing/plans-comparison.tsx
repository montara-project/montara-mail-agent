import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
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

/** What each tier carries, in the pricing page's words (apps/main-web/lib/pricing.ts). */
const FEATURES = {
  free: [
    'Up to 20 connected email accounts',
    'Up to 2 organizations',
    '10M AI tokens a week',
    'Top-up token balance (pay-as-you-go)',
    'Email support (working hours)',
  ],
  pro: [
    'Unlimited connected email accounts',
    '10 organizations',
    '100M AI tokens a week',
    'Top-up token balance (pay-as-you-go)',
    'Email support 24/7',
  ],
  enterprise: [
    'Unlimited connected email accounts',
    'Unlimited organizations',
    'Unlimited AI tokens',
    'Dedicated support',
  ],
}

/** The discount that is running right now, if any. */
const effectivePrice = (plan: Models.BillingPlan) =>
  plan.discount_amount > 0 &&
  (!plan.discount_ends_at || new Date(plan.discount_ends_at) > new Date())
    ? plan.amount - plan.discount_amount
    : plan.amount

/**
 * One tier: what it costs and its action above the line, what it carries below.
 * Two subgrid rows, so the line sits at the same height on all three.
 */
function Tier({
  name,
  badge,
  price,
  unit,
  note,
  tagline,
  features,
  featured,
  action,
}: {
  name: string
  badge?: string
  price?: string
  unit?: string
  note?: React.ReactNode
  tagline: string
  features: string[]
  featured?: boolean
  action?: React.ReactNode
}) {
  return (
    <div className="row-span-2 grid grid-rows-subgrid gap-0 overflow-hidden rounded-xl border">
      <div className={cn('flex flex-col gap-4 p-5', featured && 'bg-muted/50')}>
        <div className="flex min-h-6 items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{name}</h3>
          {badge && (
            <Badge variant="secondary" appearance="light" size="sm">
              {badge}
            </Badge>
          )}
        </div>
        <div className="grid gap-1.5">
          <div className="flex min-h-10 flex-wrap items-center gap-x-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{price}</span>
            {unit && (
              <span className="text-muted-foreground w-min text-xs leading-tight">{unit}</span>
            )}
          </div>
          {note}
        </div>
        <p className="text-muted-foreground text-sm">{tagline}</p>
        {action && <div className="mt-auto pt-1 *:w-full">{action}</div>}
      </div>
      <div className="grid content-start gap-3 border-t p-5">
        <h4 className="text-xs font-semibold tracking-wide uppercase">Features</h4>
        <ul className="grid gap-2.5 text-sm">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <span className="mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full bg-lime-400 text-lime-950">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const currentPlanButton = (
  <Button variant="outline" disabled>
    Current plan
  </Button>
)

export default function PlansComparison() {
  const plansQuery = useQuery(queries.billing.plans())
  const { data: quota } = useQuery(queries.quota.status())
  const { data: subscription } = useQuery(queries.billing.subscription())
  const plans = plansQuery.data ?? []
  const monthly = plans.find((p) => p.code === 'pro_monthly')
  const yearly = plans.find((p) => p.code === 'pro_yearly')
  const [billing, setBilling] = React.useState<'month' | 'year'>('year')
  const pro = billing === 'month' ? monthly : yearly

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

  const discounted = pro && effectivePrice(pro) < pro.amount
  const yearlySaving =
    yearly && effectivePrice(yearly) < yearly.amount
      ? Math.round((yearly.discount_amount / yearly.amount) * 100)
      : 0

  let proAction: React.ReactNode
  if (quota?.plan === 'pro') proAction = currentPlanButton
  else if (subscription?.status === 'pending') proAction = <Button disabled>Payment pending</Button>
  else if (quota?.plan !== 'enterprise')
    proAction = (
      <Button disabled={!pro || checkout.isPending} onClick={() => pro && upgrade(pro.code)}>
        {checkout.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Upgrade to Pro
      </Button>
    )

  return (
    <>
      <SectionCard
        title="Plans"
        description="What each tier carries. Upgrading renews from your wallet automatically."
      >
        <QueryState
          isPending={plansQuery.isPending}
          isError={plansQuery.isError && !plansQuery.data}
          error={plansQuery.error}
          onRetry={() => void plansQuery.refetch()}
          isEmpty={false}
          loading={<Skeleton className="h-96 w-full" />}
          empty={null}
        >
          {monthly && yearly && (
            <div className="bg-muted mb-5 inline-flex max-w-full gap-0.5 rounded-lg p-1 text-sm">
              {(['month', 'year'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={billing === value}
                  onClick={() => setBilling(value)}
                  className={cn(
                    'focus-visible:ring-ring/50 flex items-center gap-2 rounded-md border px-3 py-1 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px]',
                    billing === value
                      ? 'bg-background shadow-xs'
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  )}
                >
                  {value === 'month' ? 'Monthly' : 'Yearly'}
                  <span className="hidden sm:inline -ms-1">billing</span>
                  {value === 'year' && yearlySaving > 0 && (
                    <Badge variant="secondary" appearance="light" size="sm">
                      Save {yearlySaving}%
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Measured on the card, not the viewport: the sidebar takes a varying share of it. */}
          <div className="@container">
            <div className="grid auto-rows-auto gap-x-4 gap-y-4 @3xl:grid-cols-3">
              <Tier
                name="Free"
                price="Rp0"
                tagline="The essentials for trying the agent."
                features={FEATURES.free}
                action={quota?.plan === 'free' ? currentPlanButton : undefined}
              />
              <Tier
                name="Pro"
                featured
                badge={quota?.plan === 'pro' ? undefined : 'Recommended'}
                price={pro && formatRupiah(effectivePrice(pro))}
                unit={billing === 'month' ? 'per month' : 'per year'}
                note={
                  pro &&
                  discounted && (
                    <p className="text-xs">
                      <span className="text-muted-foreground me-1.5 line-through">
                        {formatRupiah(pro.amount)}
                      </span>
                      <span className="text-green-700 dark:text-green-400">
                        Save {formatRupiah(pro.discount_amount)}
                        {pro.discount_ends_at
                          ? ` until ${monthDay(new Date(pro.discount_ends_at), true)}`
                          : ''}
                      </span>
                    </p>
                  )
                }
                tagline="For teams who live in their inbox."
                features={FEATURES.pro}
                action={proAction}
              />
              <Tier
                name="Enterprise"
                price="Custom"
                tagline="Unlimited everything, billed per contract."
                features={FEATURES.enterprise}
                action={
                  quota?.plan === 'enterprise' ? (
                    currentPlanButton
                  ) : (
                    <Button asChild>
                      <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
                    </Button>
                  )
                }
              />
            </div>
          </div>
        </QueryState>
      </SectionCard>

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
