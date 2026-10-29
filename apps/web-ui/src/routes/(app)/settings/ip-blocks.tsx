import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import EmptyState from '@/components/block/common/empty-state'
import IPBlockList from '@/components/block/settings/ip-block-list'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api/queries'

export const Route = createFileRoute('/(app)/settings/ip-blocks')({
  component: RouteComponent,
})

// Blocks are server-wide, so only a super user manages them; the API refuses
// anyone else too.
function RouteComponent() {
  const { data: security, isPending } = useQuery(queries.profile.security())

  if (isPending) return <Skeleton className="h-40" />
  if (!security?.super_user) {
    return (
      <EmptyState
        title="Only a super user manages IP blocks"
        description="Blocks apply to the whole server, so they belong to whoever runs it."
      />
    )
  }
  return <IPBlockList />
}
