import { createFileRoute } from '@tanstack/react-router'

import { BillingSettings } from '@/components/block/settings/settings-pages'

export const Route = createFileRoute('/(app)/settings/billing')({
  component: BillingSettings,
})
