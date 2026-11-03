import { useQuery } from '@tanstack/react-query'

import SectionHeading from '@/components/block/common/section-heading'
import { SettingsPage } from '@/components/block/common/settings-card'
import PlanWalletCard from '@/components/block/settings/billing/plan-wallet-card'
import PlansComparison from '@/components/block/settings/billing/plans-comparison'
import RecentTopupsLedger from '@/components/block/settings/billing/recent-topups-ledger'
import TokenTopUpCard from '@/components/block/settings/billing/token-topup-card'
import UsageCard from '@/components/block/settings/billing/usage-card'
import { queries } from '@/lib/api/queries'

/** Control Center > Billing: the plan and the wallet it renews from, the
 * week's AI usage, the wallet's top-up row, and the plans. */
export default function QuotaSettings() {
  const securityQuery = useQuery(queries.profile.security())
  // A super user has no plan to buy past and no wallet to top up.
  const showPurchases = !securityQuery.isPending && !securityQuery.data?.super_user

  return (
    <SettingsPage>
      <SectionHeading
        title="Billing"
        description="Your plan, the wallet it renews from, and this week's AI usage."
      />
      <div className="grid gap-5">
        <PlanWalletCard />

        <p className="text-ink-faint font-mono text-[9.5px] font-semibold tracking-[1px] uppercase">
          Usage
        </p>
        <UsageCard />

        {showPurchases && (
          <>
            <p className="text-ink-faint font-mono text-[9.5px] font-semibold tracking-[1px] uppercase">
              Top up
            </p>
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <TokenTopUpCard />
              <RecentTopupsLedger />
            </div>

            <PlansComparison />
          </>
        )}
      </div>
    </SettingsPage>
  )
}
