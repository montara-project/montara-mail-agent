import { createFileRoute } from '@tanstack/react-router'

import SelfHostedSettings from '@/components/block/settings/self-hosted-form'

export const Route = createFileRoute('/(app)/settings/self-hosted')({
  component: SelfHostedSettings,
})
