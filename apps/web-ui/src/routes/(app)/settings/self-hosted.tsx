import { createFileRoute } from '@tanstack/react-router'

import ServerSettings from '@/components/block/settings/server-url-form'

export const Route = createFileRoute('/(app)/settings/self-hosted')({
  component: ServerSettings,
})
