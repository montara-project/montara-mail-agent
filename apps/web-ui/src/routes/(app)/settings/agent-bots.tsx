import { createFileRoute } from '@tanstack/react-router'

import AgentBotList from '@/components/block/agent-bot/agent-bot-list'
import NoOrganization, { OrganizationsError } from '@/components/block/settings/no-organization'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'

export const Route = createFileRoute('/(app)/settings/agent-bots')({
  component: RouteComponent,
})

function RouteComponent() {
  const { organization, isPending, isError } = useActiveOrganization()

  if (isPending) return <Skeleton className="h-40" />
  if (isError) {
    return <OrganizationsError />
  }
  if (!organization) {
    return (
      <NoOrganization description="Create or switch to an organization to manage its agent bots." />
    )
  }
  return <AgentBotList organizationId={organization.id} />
}
