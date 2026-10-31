import { createFileRoute, redirect } from '@tanstack/react-router'

import QuotaSettings from '@/components/block/settings/quota-settings'
import { COMMUNITY } from '@/lib/constants/edition'

export const Route = createFileRoute('/(app)/settings/billing')({
  // The Community Edition takes no payments.
  beforeLoad: () => {
    if (COMMUNITY) throw redirect({ to: '/settings/profile', replace: true })
  },
  component: COMMUNITY ? () => null : QuotaSettings,
})
