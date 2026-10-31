import { createFileRoute } from '@tanstack/react-router'

import AgentPanelSettings from '@/components/block/settings/agent-panel-settings'

export const Route = createFileRoute('/(app)/settings/ai-assistant-panel')({
  component: AgentPanelSettings,
})
