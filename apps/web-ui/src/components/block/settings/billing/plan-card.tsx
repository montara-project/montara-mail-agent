import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, Sparkles } from 'lucide-react'
import React from 'react'

import QueryState from '@/components/block/common/query-state'
import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { monthDay } from '@/lib/date'
import { formatRupiah } from '@/lib/string'

/** The badge's tier: a free plan with no limit is a super user's. */
function PlanBadge({ plan, unlimited }: { plan: string; unlimited: boolean }) {
  if (plan === 'free' && !unlimited) {
    return (
      <Badge variant="secondary" appearance="light" size="sm">
        Free
      </Badge>
    )
  }
  return (
    <Badge variant="success" appearance="light" size="sm">
      {plan !== 'pro' && <Sparkles aria-hidden />}
      {plan === 'pro' ? 'Pro' : plan === 'enterprise' ? 'Enterprise' : 'Unlimited'}
    </Badge>
  )
}

/** The tier's display name, the pricing page's words. */
function planName(plan: string, unlimited: boolean) {
  if (plan === 'pro') return 'Pro'
  if (plan === 'enterprise') return 'Enterprise'
  return plan === 'free' && !unlimited ? 'Free' : 'Unlimited'
}

/**
 * Control Center > Billing: the Current Plan card of the plan row — the tier,
 * how the subscription renews, and the auto-renew switch.
 */
export default function PlanCard() {
  const quotaQuery = useQuery(queries.quota.status())
  const subscriptionQuery = useQuery(queries.billing.subscription())
  const { data: security } = useQuery(queries.profile.security())
  const autoRenew = useMutation(queries.billing.autoRenew())

  const { data: quota, refetch: refetchQuota } = quotaQuery
  const sub = subscriptionQuery.data ?? null
  const pending = sub?.status === 'pending'
  const active = sub?.status === 'active'

  // A pending checkout turning active changes the tier and its allowance.
  React.useEffect(() => {
    if (active) void refetchQuota()
  }, [active, refetchQuota])

  return (
    <SectionCard
      title="Current plan"
      toolbar={
        quota ? <PlanBadge plan={quota.plan} unlimited={quota.limit_tokens === null} /> : undefined
      }
    >
      <div className="grid gap-3 text-sm">
        {quota ? (
          <p className="text-xl font-semibold tracking-tight">
            {planName(quota.plan, quota.limit_tokens === null)}
          </p>
        ) : (
          <Skeleton className="h-7 w-24" />
        )}

        <QueryState
          isPending={subscriptionQuery.isPending}
          isError={subscriptionQuery.isError && !sub}
          error={subscriptionQuery.error}
          onRetry={() => void subscriptionQuery.refetch()}
          isEmpty={false}
          loading={<Skeleton className="h-5 w-full" />}
          empty={null}
        >
          {pending && sub && (
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">
                  Checkout for the {sub.plan_name} plan
                  {sub.billing_interval === 'year' ? ', yearly' : ', monthly'}
                </span>
                <span className="tabular-nums">{formatRupiah(sub.amount)}</span>
              </div>
              <Button size="sm" className="w-fit" asChild>
                <a href={sub.pay_url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden />
                  Finish the payment
                </a>
              </Button>
            </div>
          )}

          {active && sub && (
            <React.Fragment>
              <p className="text-muted-foreground">
                {sub.auto_renew ? 'Renews' : 'Ends'}{' '}
                {sub.current_period_end ? monthDay(new Date(sub.current_period_end), true) : '–'}
                {sub.auto_renew
                  ? ' from your wallet'
                  : `. Turn auto-renew back on to keep ${sub.plan_name}.`}
                <span className="text-foreground ms-2 tabular-nums">
                  {formatRupiah(sub.amount)}
                </span>
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground" id="billing-auto-renew">
                  Auto-renew
                </span>
                <Switch
                  aria-labelledby="billing-auto-renew"
                  checked={sub.auto_renew}
                  disabled={autoRenew.isPending}
                  onCheckedChange={(checked) =>
                    autoRenew.mutate({ enabled: checked }, { onError: toastAxiosError })
                  }
                />
              </div>
            </React.Fragment>
          )}

          {!pending && !active && security && !security.super_user && (
            <p className="text-muted-foreground">No subscription. Pick a plan below to upgrade.</p>
          )}
        </QueryState>
      </div>
    </SectionCard>
  )
}
