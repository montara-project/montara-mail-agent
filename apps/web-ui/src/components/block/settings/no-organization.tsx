import { Plus } from 'lucide-react'
import React from 'react'

import EmptyState from '@/components/block/common/empty-state'
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
