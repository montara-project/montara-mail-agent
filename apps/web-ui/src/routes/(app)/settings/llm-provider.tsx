import { createFileRoute } from '@tanstack/react-router'

import LLMProviderSettings from '@/components/block/settings/llm-provider-form'

export const Route = createFileRoute('/(app)/settings/llm-provider')({
  component: LLMProviderSettings,
})
