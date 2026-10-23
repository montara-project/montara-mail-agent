import { createFileRoute } from '@tanstack/react-router'

import GeneralSettings from '@/components/block/settings/general-settings'

export const Route = createFileRoute('/(app)/settings/profile')({
  component: GeneralSettings,
})
