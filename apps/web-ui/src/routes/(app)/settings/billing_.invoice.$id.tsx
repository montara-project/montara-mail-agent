import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

import TopupInvoicePage from '@/components/block/settings/billing/topup-invoice-page'
import { queries } from '@/lib/api/queries'
import { COMMUNITY } from '@/lib/constants/edition'
import { formatTokens } from '@/lib/string'

/** The invoice for one AI token top-up, laid out to print as a single page. */
function InvoicePage() {
  const { id } = Route.useParams()
  const topup = useQuery(queries.quota.topup(id))
  return (
    <TopupInvoicePage
      query={topup}
      describe={(t) => `${formatTokens(t.tokens)} token top-up (pay as you go)`}
    />
  )
}

export const Route = createFileRoute('/(app)/settings/billing_/invoice/$id')({
  // The Community Edition takes no payments, so it has no invoices.
  beforeLoad: () => {
    if (COMMUNITY) throw redirect({ to: '/settings/profile', replace: true })
  },
  component: COMMUNITY ? () => null : InvoicePage,
})
