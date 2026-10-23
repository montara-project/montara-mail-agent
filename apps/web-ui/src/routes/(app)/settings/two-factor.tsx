import { createFileRoute } from '@tanstack/react-router'

import TOTPSettings from '@/components/block/settings/totp-settings'

export const Route = createFileRoute('/(app)/settings/two-factor')({
  component: TOTPSettings,
})
