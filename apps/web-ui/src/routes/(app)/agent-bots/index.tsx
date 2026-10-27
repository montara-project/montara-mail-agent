import { createFileRoute } from '@tanstack/react-router'

import AgentBotList from '@/components/block/agent-bot/agent-bot-list'
import EmptyState from '@/components/block/common/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'

export const Route = createFileRoute('/(app)/agent-bots/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { organization, isPending } = useActiveOrganization()

  if (isPending) return <Skeleton className="h-40" />
  if (!organization) {
    return (
      <EmptyState
        title="No organization selected"
        description="Create or switch to an organization to manage its agent bots."
      />
    )
  }
  return <AgentBotList organizationId={organization.id} />
}
