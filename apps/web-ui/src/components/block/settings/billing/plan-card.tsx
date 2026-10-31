import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, Sparkles } from 'lucide-react'
import React from 'react'

import { Separator } from '#/components/ui/separator'
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
      <Badge variant="secondary" appearance="light">
        Free
      </Badge>
    )
  }
  return (
    <Badge variant="success" appearance="light">
      {plan !== 'pro' && <Sparkles aria-hidden />}
      {plan === 'pro' ? 'Pro' : plan === 'enterprise' ? 'Enterprise' : 'Unlimited'}
    </Badge>
  )
}

/**
 * Control Center > Billing: the tier, the subscription's state and, as
 * children, what the tier has spent this week.
 */
export default function PlanCard({ children }: { children: React.ReactNode }) {
  const quotaQuery = useQuery(queries.quota.status())
  const subscriptionQuery = useQuery(queries.billing.subscriptionWhilePending())
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
      description="Your tier, how the subscription renews, and this week's AI usage."
      toolbar={
        quota ? <PlanBadge plan={quota.plan} unlimited={quota.limit_tokens === null} /> : undefined
      }
    >
      <div className="grid gap-4 text-sm">
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
            <div className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">
                  {sub.auto_renew ? 'Renews' : 'Ends'}{' '}
                  {sub.current_period_end ? monthDay(new Date(sub.current_period_end), true) : '–'}
                  {sub.auto_renew
                    ? ' from your wallet'
                    : `. Turn auto-renew back on to keep ${sub.plan_name}.`}
                </span>
                <span className="tabular-nums">{formatRupiah(sub.amount)}</span>
              </div>
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
            </div>
          )}

          {!pending && !active && security && !security.super_user && (
            <p className="text-muted-foreground">No subscription. Pick a plan below to upgrade.</p>
          )}
        </QueryState>

        <Separator />

        {children}
      </div>
    </SectionCard>
  )
}
