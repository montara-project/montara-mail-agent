import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

import TopupInvoicePage from '@/components/block/settings/billing/topup-invoice-page'
import { queries } from '@/lib/api/queries'
import { COMMUNITY } from '@/lib/constants/edition'

/** The invoice for one wallet top-up, laid out to print as a single page. */
function InvoicePage() {
  const { id } = Route.useParams()
  const topup = useQuery(queries.billing.walletTopupById(id))
  return <TopupInvoicePage query={topup} describe={() => 'Wallet top-up'} />
}

export const Route = createFileRoute('/(app)/settings/billing_/wallet-invoice/$id')({
  // The Community Edition takes no payments, so it has no invoices.
  beforeLoad: () => {
    if (COMMUNITY) throw redirect({ to: '/settings/profile', replace: true })
  },
  component: COMMUNITY ? () => null : InvoicePage,
})
