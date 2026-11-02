import { useMutation } from '@tanstack/react-query'
import { Building2, Check, Pencil, Plus, SearchIcon, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import { SettingsListCard } from '@/components/block/common/settings-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { OrganizationsError } from '@/components/block/settings/no-organization'
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
import { COMMUNITY } from '@/lib/constants/edition'
import { monthDay } from '@/lib/date'
import { cn } from '@/lib/utils'

/** How many organizations a list holds before it offers a search. */
const SEARCH_FROM = 6

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
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-[11px] gap-y-1.5 rounded-md border px-[9px] py-2 transition-colors duration-150 motion-reduce:transition-none',
        active ? 'border-accent-ink/40 bg-accent-ink/6' : 'hover:bg-muted border-transparent'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-[8px] text-[11.5px] font-bold',
          active ? 'bg-accent-tint text-accent-soft' : 'bg-muted text-muted-foreground'
        )}
      >
        {record.name.trim()[0]?.toUpperCase() || '·'}
      </span>
      <span className="grid min-w-0 flex-1 gap-px">
        <span
          className={cn(
            'text-xs leading-4 wrap-anywhere',
            active ? 'font-bold' : 'text-ink-strong font-medium'
          )}
        >
          {record.name}
        </span>
        <span className="text-ink-3 text-[10.5px] leading-[14px]">
          Since {monthDay(new Date(record.created_at))}
        </span>
      </span>
      {active ? (
        <span className="bg-accent-ink/6 text-accent-soft flex shrink-0 items-center gap-1 rounded-tag px-1.5 py-[3px] text-[10.5px] leading-[14px] font-bold">
          <Check className="size-[9px]" aria-hidden />
          Current
        </span>
      ) : (
        <Button
          variant="ghost"
          className="text-muted-foreground h-[22px] rounded-chip px-2 text-[10.5px] font-semibold pointer-coarse:h-11"
          onClick={() => setActiveOrganizationId(record.id)}
        >
          Switch
        </Button>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          mode="icon"
          className="text-ink-3 size-[22px] rounded-chip pointer-coarse:size-11 [&_svg]:size-[11px]"
          aria-label={`Edit ${record.name}`}
          onClick={() => setOpenEdit(true)}
        >
          <Pencil />
        </Button>
        {/* Switch away first: the control center is applied to the current one. */}
        {!active && (
          <Button
            variant="ghost"
            mode="icon"
            className="text-danger-soft hover:text-danger-soft size-[22px] rounded-chip pointer-coarse:size-11 [&_svg]:size-[11px]"
            aria-label={`Delete ${record.name}`}
            onClick={() => setOpenDelete(true)}
          >
            <Trash2 />
          </Button>
        )}
      </div>

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
  const { organization, organizations, isPending, isError } = useActiveOrganization()
  const [openAdd, setOpenAdd] = React.useState(false)
  const [search, setSearch] = React.useState('')

  // The hook already holds the user's organizations, so search filters them here.
  const term = search.trim().toLowerCase()
  const shown = term
    ? organizations.filter((org) => org.name.toLowerCase().includes(term))
    : organizations
  const count = organizations.length
  const noun = count === 1 ? 'workspace' : 'workspaces'

  const content = () => {
    if (isPending) {
      return (
        <div className="grid gap-3 p-2">
          {[0, 1].map((index) => (
            <div key={index} className="flex items-center gap-[11px]">
              <Skeleton className="size-7 rounded-[8px]" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (isError) return <OrganizationsError />
    if (shown.length === 0) {
      return (
        <EmptyState
          title="No organizations found"
          description={term ? 'Try another search.' : 'Add your first organization.'}
        />
      )
    }
    return (
      <ul className="grid gap-0.5">
        {shown.map((org) => (
          <OrganizationRow key={org.id} record={org} active={org.id === organization?.id} />
        ))}
      </ul>
    )
  }

  return (
    <SettingsListCard
      icon={Building2}
      title="Your organizations"
      description={`Control center scope: ${count} ${noun}`}
      count={count}
      noun={noun}
      footer={
        <>
          <Button
            mode="link"
            className="text-muted-foreground h-auto gap-1.5 p-0 text-[11px] leading-[15px] font-semibold no-underline pointer-coarse:h-11 [&_svg]:size-[11px]"
            onClick={() => setOpenAdd(true)}
          >
            <Plus />
            Create organization
          </Button>
          {/* Members and roles aren't built yet; the Community Edition has one user. */}
          {!COMMUNITY && (
            <span className="text-ink-3 flex items-center gap-1.5 text-[11px] leading-[15px] font-medium">
              Manage access
              <Badge variant="secondary" appearance="light" size="sm">
                Soon
              </Badge>
            </span>
          )}
        </>
      }
    >
      {count >= SEARCH_FROM && (
        <InputWrapper className="mx-2 mb-2 w-auto">
          <SearchIcon />
          <Input
            placeholder="Search organizations..."
            aria-label="Search organizations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </InputWrapper>
      )}
      {content()}

      <AddOrganizationForm open={openAdd} onOpenChange={setOpenAdd} />
    </SettingsListCard>
  )
}
