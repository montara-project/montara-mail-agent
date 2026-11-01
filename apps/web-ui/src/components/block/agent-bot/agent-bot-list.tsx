import { useMutation, useQuery } from '@tanstack/react-query'
import { Bot, Plus, SquarePen, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { AddAgentBotForm, EditAgentBotForm } from '@/components/block/agent-bot/agent-bot-form'
import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import SectionHeading from '@/components/block/common/section-heading'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

function AgentBotRow({ record }: { record: Models.AgentBot }) {
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openDelete, setOpenDelete] = React.useState(false)
  const deleteMutation = useMutation(queries.agentBots.delete())

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(record.id)
      toast.success('Agent bot deleted successfully')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <li className="flex items-center gap-3 py-3">
      {/* A bot is an AI thing, so its tile carries the AI accent. */}
      <span className="bg-accent-ink/10 text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-md">
        <Bot className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{record.name}</p>
        {record.description && <p className="text-ink-3 truncate text-xs">{record.description}</p>}
      </div>
      {record.is_default && (
        <Badge variant="secondary" appearance="light" size="sm">
          Default
        </Badge>
      )}
      <Button
        variant="ghost"
        mode="icon"
        size="sm"
        aria-label={`Edit ${record.name}`}
        onClick={() => setOpenEdit(true)}
      >
        <SquarePen />
      </Button>
      <Button
        variant="destructive"
        mode="icon"
        size="sm"
        aria-label={`Delete ${record.name}`}
        onClick={() => setOpenDelete(true)}
      >
        <Trash2 />
      </Button>

      <SimpleAlertDialog
        title="Do you want to delete this agent bot?"
        description="Drafts it already wrote keep their text. This cannot be undone."
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
      <EditAgentBotForm open={openEdit} onOpenChange={setOpenEdit} record={record} />
    </li>
  )
}

/** An organization's agent bots: the personas the mail agent can speak as. */
export default function AgentBotList({ organizationId }: { organizationId: string }) {
  const [openAdd, setOpenAdd] = React.useState(false)
  const { data, isPending } = useQuery(queries.agentBots.list(organizationId))
  const bots = data?.data ?? []

  const content = () => {
    if (isPending) {
      return (
        <div className="grid gap-3 py-3">
          {[0, 1].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <div className="grid flex-1 gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (bots.length === 0) {
      return (
        <EmptyState
          title="No agent bots yet"
          description="Add a bot to give the assistant its own soul, memory, style and instructions."
        />
      )
    }
    return (
      <ul className="divide-y divide-border/60">
        {bots.map((bot) => (
          <AgentBotRow key={bot.id} record={bot} />
        ))}
      </ul>
    )
  }

  return (
    <section className="grid gap-3">
      <SectionHeading
        title="Agent Bots"
        description="Personas the AI assistant can speak as. Only the organization's owner can change them."
        action={
          <Button onClick={() => setOpenAdd(true)}>
            <Plus />
            <span>Add</span>
          </Button>
        }
      />
      <SectionCard>{content()}</SectionCard>

      <AddAgentBotForm organizationId={organizationId} open={openAdd} onOpenChange={setOpenAdd} />
    </section>
  )
}
