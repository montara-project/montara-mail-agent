import SectionHeading from '@/components/block/common/section-heading'
import { SettingsPage } from '@/components/block/common/settings-card'
import PendingPayments from '@/components/block/settings/billing/pending-payments'
import PlanWalletCard from '@/components/block/settings/billing/plan-wallet-card'
import PlansComparison from '@/components/block/settings/billing/plans-comparison'
import RecentTransactions from '@/components/block/settings/billing/recent-transactions'
import TokenTopUpCard from '@/components/block/settings/billing/token-topup-card'
import UsageCard from '@/components/block/settings/billing/usage-card'

/** Control Center > Billing: the plan and the wallet it renews from, the
 * week's AI usage, the wallet's top-up row, and the plans. */
export default function QuotaSettings() {
  // const securityQuery = useQuery(queries.profile.security())
  // A super user has no plan to buy past and no wallet to top up.
  const showPurchases = true // TEMP: local layout verification

  return (
    <SettingsPage>
      <SectionHeading
        title="Billing"
        description="Your plan, the wallet it renews from, and this week's AI usage."
      />
      <div className="grid gap-5">
        {/* First on the page: an unpaid checkout is the one thing left to do here. */}
        {showPurchases && <PendingPayments />}
        <PlanWalletCard />

        <p className="text-ink-faint font-mono text-[0.6875rem] font-semibold tracking-[0.0625rem] uppercase">
          Usage
        </p>
        <UsageCard />

        {showPurchases && (
          <>
            <p className="text-ink-faint font-mono text-[0.6875rem] font-semibold tracking-[0.0625rem] uppercase">
              Top up
            </p>
            <TokenTopUpCard />

            <PlansComparison />
            <RecentTransactions />
          </>
        )}
      </div>
    </SettingsPage>
  )
}
