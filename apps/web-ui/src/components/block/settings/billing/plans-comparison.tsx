import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import SectionCard from '@/components/block/common/section-card'
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

/** What each tier carries; the numbers are also the plans rows' data. */
const ROWS: Array<[string, string, string, string]> = [
  ['Connected email accounts', '20', 'Unlimited', 'Custom'],
  ['Organizations', '2', '10', 'Custom'],
  ['AI tokens a week', '10M', '100M + pay-as-you-go', 'Custom'],
  ['Support', 'Email (working hours)', 'Email 24/7', 'Dedicated'],
]

/** The discount that is running right now, if any. */
const effectivePrice = (plan: Models.BillingPlan) =>
  plan.discount_amount > 0 &&
  (!plan.discount_ends_at || new Date(plan.discount_ends_at) > new Date())
    ? plan.amount - plan.discount_amount
    : plan.amount

/** One tier: its name and price, what it carries (a ROWS column), and its action. */
function Tier({
  name,
  price,
  column,
  featured,
  note,
  action,
}: {
  name: string
  price: React.ReactNode
  column: 1 | 2 | 3
  featured?: boolean
  note?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        featured && 'border-primary ring-primary ring-1'
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{name}</span>
        {price}
      </div>
      <ul className="text-muted-foreground grid gap-1.5 text-sm">
        {ROWS.map((row) => (
          <li key={row[0]} className="grid gap-0.5">
            <span className="text-foreground text-xs font-medium">{row[0]}</span>
            <span>{row[column]}</span>
          </li>
        ))}
      </ul>
      {note}
      {action && <div className="mt-auto pt-1">{action}</div>}
    </div>
  )
}

const currentPlanButton = (
  <Button variant="outline" size="sm" disabled>
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
  const [billing, setBilling] = React.useState<'month' | 'year'>('month')
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
  else if (subscription?.status === 'pending')
    proAction = (
      <Button size="sm" disabled>
        Payment pending
      </Button>
    )
  else if (quota?.plan !== 'enterprise')
    proAction = (
      <Button
        size="sm"
        disabled={!pro || checkout.isPending}
        onClick={() => pro && upgrade(pro.code)}
      >
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
          loading={<Skeleton className="h-72 w-full" />}
          empty={null}
        >
          {monthly && yearly && (
            <div className="mb-4 inline-flex rounded-md border p-0.5 text-sm">
              {(['month', 'year'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={billing === value}
                  onClick={() => setBilling(value)}
                  className={cn(
                    'focus-visible:ring-ring/50 rounded px-3 py-1 transition-colors outline-none focus-visible:ring-[3px]',
                    billing === value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {value === 'month' ? 'Monthly' : 'Yearly'}
                  {value === 'year' && yearlySaving > 0 && ` · save ${yearlySaving}%`}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Tier
              name="Free"
              column={1}
              price={<span className="text-muted-foreground tabular-nums">Rp0</span>}
              action={quota?.plan === 'free' ? currentPlanButton : undefined}
            />
            <Tier
              name="Pro"
              column={2}
              featured
              price={
                pro && (
                  <span className="text-right tabular-nums">
                    {discounted && (
                      <span className="text-muted-foreground me-1.5 text-sm line-through">
                        {formatRupiah(pro.amount)}
                      </span>
                    )}
                    <span className="text-base font-semibold">
                      {formatRupiah(effectivePrice(pro))}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      /{billing === 'month' ? 'mo' : 'yr'}
                    </span>
                  </span>
                )
              }
              note={
                pro &&
                discounted && (
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Save {formatRupiah(pro.discount_amount)}
                    {pro.discount_ends_at
                      ? ` until ${monthDay(new Date(pro.discount_ends_at), true)}.`
                      : '.'}
                  </p>
                )
              }
              action={proAction}
            />
            <Tier
              name="Enterprise"
              column={3}
              price={<span className="text-muted-foreground">Custom</span>}
              action={
                quota?.plan === 'enterprise' ? (
                  currentPlanButton
                ) : (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a>
                  </Button>
                )
              }
            />
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
