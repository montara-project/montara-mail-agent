import { useMutation } from '@tanstack/react-query'
import { Plus, SearchIcon, SquarePen, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import {
  AddOrganizationForm,
  EditOrganizationForm,
} from '@/components/block/settings/organization-form'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { setActiveOrganizationId, useActiveOrganization } from '@/hooks/use-active-organization'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { monthDay } from '@/lib/date'
import { cn } from '@/lib/utils'

/** Orgs have no logo, so each gets a stable tint from the brand palette. */
const ORG_TINTS = [
  'var(--brand-outlook)',
  'var(--brand-gmail)',
  'var(--brand-proton)',
  'var(--brand-yahoo)',
  'var(--brand-icloud)',
]

const orgTint = (name: string) =>
  ORG_TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % ORG_TINTS.length]

/** The org's initial on a brand-tinted tile. */
function OrgTile({ name, active }: { name: string; active?: boolean }) {
  const tint = active ? 'var(--accent-ink)' : orgTint(name)
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg border text-[12.5px] font-bold',
        !active && 'border-transparent bg-muted text-muted-foreground'
      )}
      style={
        active
          ? {
              color: tint,
              backgroundColor: `color-mix(in srgb, ${tint} 15%, transparent)`,
              borderColor: `color-mix(in srgb, ${tint} 25%, transparent)`,
            }
          : undefined
      }
    >
      {name.trim()[0]?.toUpperCase() || '·'}
    </span>
  )
}

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
        'flex items-center gap-3 rounded-[10px] border p-3',
        active ? 'bg-muted border-border' : 'border-transparent'
      )}
    >
      <OrgTile name={record.name} active={active} />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[12.5px] font-semibold">{record.name}</span>
        <span className="text-ink-3 text-[11px]">
          Since {monthDay(new Date(record.created_at))}
        </span>
      </span>
      {active ? (
        <span className="bg-success/10 text-success flex shrink-0 items-center gap-1.5 rounded-[5px] px-[7px] py-[3px] text-[10.5px] font-semibold">
          <span className="size-[5px] rounded-full bg-success" aria-hidden />
          Active
        </span>
      ) : (
        <Button
          variant="secondary"
          className="h-[26px] rounded-[7px] border-border bg-muted px-2.5 text-[11.5px] font-semibold shadow-none"
          onClick={() => setActiveOrganizationId(record.id)}
        >
          Switch
        </Button>
      )}
      <Button
        variant="ghost"
        mode="icon"
        size="sm"
        className="text-muted-foreground [&_svg]:size-3.5"
        aria-label={`Edit ${record.name}`}
        onClick={() => setOpenEdit(true)}
      >
        <SquarePen />
      </Button>
      <Button
        variant="ghost"
        mode="icon"
        size="sm"
        className="text-ink-faint hover:text-destructive [&_svg]:size-3.5"
        aria-label={`Delete ${record.name}`}
        onClick={() => setOpenDelete(true)}
      >
        <Trash2 />
      </Button>

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
        <div className="grid gap-3 py-3">
          {[0, 1].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
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
      <ul className="grid gap-1.5">
        {shown.map((org) => (
          <OrganizationRow key={org.id} record={org} active={org.id === organization?.id} />
        ))}
      </ul>
    )
  }

  return (
    <SectionCard
      title="Organizations"
      description="Switch the workspace the whole control center applies to."
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
          <Button
            variant="secondary"
            className="h-[30px] rounded-lg border-border bg-muted px-3 text-[11.5px] font-semibold shadow-none [&_svg]:size-3"
            onClick={() => setOpenAdd(true)}
          >
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
