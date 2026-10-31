import { useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCw } from 'lucide-react'
import React from 'react'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import { AddOrganizationForm } from '@/components/block/settings/organization-form'
import { Button } from '@/components/ui/button'
import { setActiveOrganizationId } from '@/hooks/use-active-organization'

/** What a page scoped to an organization shows without one, with a way to add it. */
export default function NoOrganization({ description }: { description: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <EmptyState
        title="No organization selected"
        description={description}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            Add organization
          </Button>
        }
      />
      <AddOrganizationForm
        open={open}
        onOpenChange={setOpen}
        onSaved={(org) => setActiveOrganizationId(org.id)}
      />
    </>
  )
}

/** The organizations list request failed: retry, rather than offering to
 * create one — an empty list and a failed one look alike from here. */
export function OrganizationsError() {
  const qc = useQueryClient()

  return (
    <SectionCard
      title="Couldn't load your organizations"
      description="The request that lists your organizations didn't answer."
      toolbar={
        <Button size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['organizations'] })}>
          <RotateCw aria-hidden />
          Retry
        </Button>
      }
    >
      <p className="text-muted-foreground text-sm">
        The organizations list request failed, so Montara Mail can't tell whether you belong to any.
      </p>
    </SectionCard>
  )
}
