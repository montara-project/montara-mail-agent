import { useMutation } from '@tanstack/react-query'
import { Plus, SearchIcon } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import RowColumnAction from '@/components/block/common/row-column-action'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import {
  AddOrganizationForm,
  EditOrganizationForm,
} from '@/components/block/settings/organization-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { setActiveOrganizationId, useActiveOrganization } from '@/hooks/use-active-organization'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

function OrganizationRow({ record, active }: { record: Models.Organization; active: boolean }) {
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openDelete, setOpenDelete] = React.useState(false)
  const deleteMutation = useMutation(queries.organizations.delete())

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id)
      toast.success('Organization deleted successfully')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{record.name}</span>
      {active ? (
        <Badge variant="success" appearance="light">
          Active
        </Badge>
      ) : (
        <Button mode="link" underline="solid" onClick={() => setActiveOrganizationId(record.id)}>
          Switch
        </Button>
      )}
      <RowColumnAction onEdit={() => setOpenEdit(true)} onDelete={() => setOpenDelete(true)} />

      <SimpleAlertDialog
        title="Do you want to delete this organization?"
        description="This organization will be permanently deleted and cannot be undone."
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
      <EditOrganizationForm open={openEdit} onOpenChange={setOpenEdit} record={record} />
    </li>
  )
}

/** Every organization the user belongs to: add, rename, delete, or switch to one. */
export default function OrganizationList() {
  const { organization, organizations, isPending } = useActiveOrganization()
  const [openAdd, setOpenAdd] = React.useState(false)
  const [search, setSearch] = React.useState('')

  // The hook already holds the user's organizations, so search filters them here.
  const term = search.trim().toLowerCase()
  const shown = term
    ? organizations.filter((org) => org.name.toLowerCase().includes(term))
    : organizations

  const content = () => {
    if (isPending) {
      return (
        <div className="grid gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )
    }
    if (shown.length === 0) {
      return (
        <EmptyState
          title="No organizations found"
          description={term ? 'Try another search.' : 'Add your first organization.'}
        />
      )
    }
    return (
      <ul className="divide-y">
        {shown.map((org) => (
          <OrganizationRow key={org.id} record={org} active={org.id === organization?.id} />
        ))}
      </ul>
    )
  }

  return (
    <SectionCard
      title="Organizations"
      description="Every organization you belong to."
      toolbar={
        <div className="flex flex-row items-center gap-2">
          <InputWrapper className="w-56">
            <SearchIcon />
            <Input
              placeholder="Search organizations..."
              aria-label="Search organizations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </InputWrapper>
          <Button className="h-8.5 rounded-lg" onClick={() => setOpenAdd(true)}>
            <Plus />
            <span>Add</span>
          </Button>
        </div>
      }
    >
      {content()}

      <AddOrganizationForm open={openAdd} onOpenChange={setOpenAdd} />
    </SectionCard>
  )
}
