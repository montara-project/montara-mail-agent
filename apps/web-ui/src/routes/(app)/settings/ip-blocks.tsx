import { createFileRoute, redirect } from '@tanstack/react-router'

import IPBlockList from '@/components/block/settings/ip-block-list'
import { queries } from '@/lib/api/queries'
import { getQueryClient } from '@/lib/providers/react-query'

export const Route = createFileRoute('/(app)/settings/ip-blocks')({
  // Blocks are server-wide, so only a super user manages them; the API refuses
  // anyone else too.
  beforeLoad: async () => {
    const security = await getQueryClient().ensureQueryData(queries.profile.security())
    if (!security.super_user) throw redirect({ to: '/settings', replace: true })
  },
  component: IPBlockList,
})
