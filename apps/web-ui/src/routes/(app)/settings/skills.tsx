import { createFileRoute } from '@tanstack/react-router'

import EmptyState from '@/components/block/common/empty-state'
import SkillList from '@/components/block/skill/skill-list'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'

export const Route = createFileRoute('/(app)/settings/skills')({
  component: RouteComponent,
})

function RouteComponent() {
  const { organization, isPending } = useActiveOrganization()

  if (isPending) return <Skeleton className="h-40" />
  if (!organization) {
    return (
      <EmptyState
        title="No organization selected"
        description="Create or switch to an organization to manage its skills."
      />
    )
  }
  return <SkillList organizationId={organization.id} />
}
