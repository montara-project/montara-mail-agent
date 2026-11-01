import { createFileRoute } from '@tanstack/react-router'

import PluginsSoon from '@/components/block/settings/plugins-soon'

export const Route = createFileRoute('/(app)/settings/plugins')({
  component: PluginsSoon,
})
