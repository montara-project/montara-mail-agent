import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown, Pencil, Plus } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { OrganizationFormSchema } from '@/lib/api/dtos/master/organization/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const ACTIVE_ORGANIZATION_KEY = 'activeOrganizationId'

// Storage can throw (private mode, blocked site data); the switcher then just forgets.
function readActiveId() {
  try {
    return localStorage.getItem(ACTIVE_ORGANIZATION_KEY)
  } catch {
    return null
  }
}

function writeActiveId(id: string) {
  try {
    localStorage.setItem(ACTIVE_ORGANIZATION_KEY, id)
  } catch {
    // Ignore: the selection still holds for this visit.
  }
}

type OrganizationFormProps = {
  /** The organization to rename; creates a new one when absent. */
  record?: Models.Organization
  onDone: (id: string) => void
  onCancel: () => void
}

/** Create or rename form, shown in place of the list inside the popover. */
function OrganizationForm({ record, onDone, onCancel }: OrganizationFormProps) {
  const mutation = useMutation(
    record ? queries.organizations.update(record.id) : queries.organizations.create()
  )

  const form = useAppForm({
    defaultValues: { name: record?.name ?? '' },
    validators: { onSubmit: OrganizationFormSchema },
    onSubmit: async ({ value }) => {
      try {
        const res = await mutation.mutateAsync(parseDto(OrganizationFormSchema, value))
        toast.success(`Organization ${record ? 'updated' : 'created'} successfully`)
        onDone(res.data.id)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <form
      className="grid gap-3 p-1"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <div className="text-sm font-medium">{record ? 'Edit' : 'Create'} organization</div>
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField asterisk label="Name" placeholder="e.g. Acme Inc" autoFocus />
        )}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : record ? 'Save' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

type View = { mode: 'list' } | { mode: 'form'; record?: Models.Organization }

/** Picks the active organization; shown at the top of every sidebar panel. */
export default function OrganizationSwitcher() {
  // ponytail: first 100 only (the API's limit cap); add search once accounts outgrow it.
  const { data, isPending, isError } = useQuery(
    queries.organizations.list({ offset: 0, limit: 100 })
  )
  const organizations = data?.data ?? []

  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<View>({ mode: 'list' })
  const [activeId, setActiveId] = React.useState(readActiveId)
  const active = organizations.find((org) => org.id === activeId) ?? organizations[0]

  const select = (id: string) => {
    setActiveId(id)
    writeActiveId(id)
    setOpen(false)
    setView({ mode: 'list' })
  }

  const label = active?.name ?? (isPending ? 'Loading...' : 'No organization')

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setView({ mode: 'list' })
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="secondary" className="w-full min-w-0 justify-between">
            <span className="truncate">{label}</span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-1">
          {view.mode === 'form' ? (
            <OrganizationForm
              key={view.record?.id ?? 'new'}
              record={view.record}
              onDone={select}
              onCancel={() => setView({ mode: 'list' })}
            />
          ) : (
            <>
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
                    onClick={() => setView({ mode: 'form', record: org })}
                  >
                    <Pencil />
                  </Button>
                </div>
              ))}
              <Separator className="my-1" />
              <button
                type="button"
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm"
                onClick={() => setView({ mode: 'form' })}
              >
                <Plus className="size-4" />
                Create organization
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>
      {/* Spans the panel edge to edge, past the header's p-4. */}
      <Separator className="-mx-4 w-auto!" />
    </>
  )
}
