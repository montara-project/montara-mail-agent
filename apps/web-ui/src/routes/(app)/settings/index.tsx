import { createFileRoute } from '@tanstack/react-router'

import SettingsNav from '@/components/block/settings/settings-nav'

export const Route = createFileRoute('/(app)/settings/')({
  component: SettingsNav,
})
