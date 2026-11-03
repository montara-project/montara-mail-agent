import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown, Pencil, Plus } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import {
  AddOrganizationForm,
  EditOrganizationForm,
} from '@/components/block/settings/organization-form'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { setActiveOrganizationId, useActiveOrganization } from '@/hooks/use-active-organization'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

/** Picks the active organization; shown at the top of every sidebar panel. */
export default function OrganizationSwitcher() {
  const { organization: active, organizations, isPending, isError } = useActiveOrganization()

  const [open, setOpen] = React.useState(false)
  // The open dialog: create when record is absent, edit otherwise.
  const [dialog, setDialog] = React.useState<{ record?: Models.Organization } | null>(null)

  const select = (id: string) => {
    setActiveOrganizationId(id)
    setOpen(false)
  }

  const openDialog = (record?: Models.Organization) => {
    setOpen(false)
    setDialog({ record })
  }
  const closeDialog = (next: boolean) => {
    if (!next) setDialog(null)
  }

  const label = active?.name ?? (isPending ? 'Loading...' : 'No organization')
  // The design's meta line under the name: the org's accounts and their unread.
  const { data: stats } = useQuery({
    ...queries.organizations.stats(active?.id),
    refetchOnWindowFocus: false,
  })
  const meta = stats
    ? `${stats.accounts} ${stats.accounts === 1 ? 'account' : 'accounts'} · ${stats.unread} unread`
    : ''

  return (
    // Same height and bottom border as the page header (h-14), so the two lines meet;
    // the negative margins cancel the panel header's p-4.
    <div className="-mx-4 -mt-4 flex h-14 shrink-0 items-center border-b px-2.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            className="h-11 w-full min-w-0 justify-between gap-2 rounded-[0.5625rem] bg-muted px-[0.4375rem] shadow-none"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-[0.375rem] bg-accent-tint text-[0.71875rem] font-bold text-accent-soft uppercase">
                {label.charAt(0).toUpperCase()}
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-xs font-semibold">{label}</span>
                {meta && <span className="text-ink-3 truncate text-[0.71875rem]">{meta}</span>}
              </span>
            </span>
            <ChevronsUpDown className="text-ink-3 size-3 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-1">
          <div className="text-muted-foreground px-2 py-1.5 text-xs">Select organization</div>
          {isError && (
            <p className="text-destructive px-2 py-1.5 text-sm">Couldn't load organizations.</p>
          )}
          {organizations.map((org) => (
            <div
              key={org.id}
              className={cn(
                'group/org hover:bg-accent flex items-center rounded-md',
                org.id === active?.id && 'bg-accent'
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm"
                onClick={() => select(org.id)}
              >
                {org.name}
              </button>
              <Button
                variant="dim"
                size="icon"
                className={cn(
                  'size-8 opacity-0 group-hover/org:opacity-100 focus-visible:opacity-100',
                  org.id === active?.id && 'opacity-100'
                )}
                aria-label={`Edit ${org.name}`}
                onClick={() => openDialog(org)}
              >
                <Pencil />
              </Button>
            </div>
          ))}
          <Separator className="my-1" />
          <button
            type="button"
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm"
            onClick={() => openDialog()}
          >
            <Plus className="size-4" />
            Create organization
          </button>
        </PopoverContent>
      </Popover>
      <AddOrganizationForm
        open={dialog !== null && !dialog.record}
        onOpenChange={closeDialog}
        onSaved={(org) => select(org.id)}
      />
      {dialog?.record && (
        <EditOrganizationForm
          key={dialog.record.id}
          open
          onOpenChange={closeDialog}
          record={dialog.record}
        />
      )}
    </div>
  )
}
