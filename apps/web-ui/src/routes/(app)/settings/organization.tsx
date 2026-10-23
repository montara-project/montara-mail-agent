import { createFileRoute } from '@tanstack/react-router'

import { OrganizationPageSettings } from '@/components/block/settings/settings-pages'

export const Route = createFileRoute('/(app)/settings/organization')({
  component: OrganizationPageSettings,
})
