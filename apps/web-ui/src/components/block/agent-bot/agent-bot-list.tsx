import { IconPlus } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { AddAgentBotForm, EditAgentBotForm } from '@/components/block/agent-bot/agent-bot-form'
import EmptyState from '@/components/block/common/empty-state'
import RowColumnAction from '@/components/block/common/row-column-action'
import SectionCard from '@/components/block/common/section-card'
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
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{record.name}</p>
        {record.description && (
          <p className="text-muted-foreground truncate text-xs">{record.description}</p>
        )}
      </div>
      {record.is_default && (
        <Badge variant="success" appearance="light">
          Default
        </Badge>
      )}
      <RowColumnAction onEdit={() => setOpenEdit(true)} onDelete={() => setOpenDelete(true)} />

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
        <div className="grid gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
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
      <ul className="divide-y">
        {bots.map((bot) => (
          <AgentBotRow key={bot.id} record={bot} />
        ))}
      </ul>
    )
  }

  return (
    <SectionCard
      title="Agent Bots"
      description="Personas the AI assistant can speak as. Only the organization's owner can change them."
      toolbar={
        <Button className="h-8.5 rounded-lg" onClick={() => setOpenAdd(true)}>
          <IconPlus />
          <span>Add</span>
        </Button>
      }
    >
      {content()}

      <AddAgentBotForm organizationId={organizationId} open={openAdd} onOpenChange={setOpenAdd} />
    </SectionCard>
  )
}
