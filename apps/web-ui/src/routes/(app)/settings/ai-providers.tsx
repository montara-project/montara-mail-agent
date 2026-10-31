import { createFileRoute, redirect } from '@tanstack/react-router'

import LLMProviderSettings from '@/components/block/settings/llm-provider-form'
import { queries } from '@/lib/api/queries'
import { getQueryClient } from '@/lib/providers/react-query'

export const Route = createFileRoute('/(app)/settings/ai-providers')({
  // Only a super user sees this page; the menu hides it from everyone else.
  beforeLoad: async () => {
    const security = await getQueryClient().ensureQueryData(queries.profile.security())
    if (!security.super_user) throw redirect({ to: '/settings', replace: true })
  },
  component: LLMProviderSettings,
})
