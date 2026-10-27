import { IconPlus } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FileText, Reply, Tags, Wand2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import RowColumnAction from '@/components/block/common/row-column-action'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { botOptions, fromBotSelect, toBotSelect } from './skill-bot'
import { AddSkillForm, EditSkillForm } from './skill-form'

/** The built-in skills' icons, also used by the reader's Skills menu. */
export const SKILL_ICONS: Record<string, typeof Wand2> = {
  summarize: FileText,
  organize: Tags,
  draft_reply: Reply,
}

/** A built-in skill: switch it on or off and pick the bot that runs it. */
function BuiltinSkillRow({
  organizationId,
  skill,
  bots,
}: {
  organizationId: string
  skill: Models.AgentSkill
  bots: Models.AgentBot[]
}) {
  const save = useMutation(queries.agentSkills.setBuiltin(organizationId, skill.key))
  const Icon = SKILL_ICONS[skill.key] ?? Wand2

  const change = (next: { is_enabled?: boolean; agent_bot_id?: string }) =>
    save.mutate(
      {
        is_enabled: next.is_enabled ?? skill.is_enabled,
        agent_bot_id: next.agent_bot_id ?? fromBotSelect(toBotSelect(skill.agent_bot_id)),
      },
      { onSuccess: () => toast.success(`${skill.name} saved`), onError: toastAxiosError }
    )

  return (
    <li className="flex flex-wrap items-center gap-3 py-3" aria-busy={save.isPending}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-48 flex-1">
        <p className="text-sm font-medium">{skill.name}</p>
        <p className="text-muted-foreground text-xs">{skill.description}</p>
      </div>
      <Select
        value={toBotSelect(skill.agent_bot_id)}
        onValueChange={(value) => change({ agent_bot_id: fromBotSelect(value) })}
        indicatorPosition="right"
      >
        <SelectTrigger
          className="h-8 w-52"
          aria-label={`Agent bot for ${skill.name}`}
          disabled={save.isPending}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {botOptions(bots).map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          id={`skill-on-${skill.key}`}
          checked={skill.is_enabled}
          disabled={save.isPending}
          onCheckedChange={(v) => change({ is_enabled: v === true })}
        />
        <label htmlFor={`skill-on-${skill.key}`}>On</label>
      </div>
    </li>
  )
}

function CustomSkillRow({
  organizationId,
  skill,
  bots,
}: {
  organizationId: string
  skill: Models.AgentSkill
  bots: Models.AgentBot[]
}) {
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openDelete, setOpenDelete] = React.useState(false)
  const deleteMutation = useMutation(queries.agentSkills.delete())
  const botName = bots.find((bot) => bot.id === skill.agent_bot_id)?.name

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(skill.key)
      toast.success('Skill deleted successfully')
      setOpenDelete(false)
    } catch (error) {
      toastAxiosError(error)
    }
  }

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
        <Wand2 className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{skill.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {skill.description || skill.instruction}
        </p>
      </div>
      {botName && (
        <Badge variant="secondary" appearance="light" className="max-w-32">
          <span className="truncate">{botName}</span>
        </Badge>
      )}
      {!skill.is_enabled && (
        <Badge variant="secondary" appearance="outline">
          Off
        </Badge>
      )}
      <RowColumnAction onEdit={() => setOpenEdit(true)} onDelete={() => setOpenDelete(true)} />

      <SimpleAlertDialog
        title="Do you want to delete this skill?"
        description="It leaves the Skills menu and the assistant's / commands. This cannot be undone."
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="destructive"
      />
      <EditSkillForm
        organizationId={organizationId}
        open={openEdit}
        onOpenChange={setOpenEdit}
        record={skill}
      />
    </li>
  )
}

/** An organization's skills: the built-in ones to switch and staff, and its custom ones. */
export default function SkillList({ organizationId }: { organizationId: string }) {
  const [openAdd, setOpenAdd] = React.useState(false)
  const { data, isPending } = useQuery(queries.agentSkills.list(organizationId))
  const bots = useQuery(queries.agentBots.list(organizationId)).data?.data ?? []
  const skills = data?.data ?? []
  const builtin = skills.filter((skill) => skill.builtin)
  const custom = skills.filter((skill) => !skill.builtin)

  const loading = (
    <div className="grid gap-3">
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
    </div>
  )

  return (
    <div className="grid gap-8">
      <SectionCard
        title="Skills"
        description="What the AI can do with an email, from the Skills menu in the reader or as a / command in the assistant. A skill with no bot of its own runs as the bot the user picked. Only the organization's owner can change them."
      >
        {isPending ? (
          loading
        ) : (
          <ul className="divide-y">
            {builtin.map((skill) => (
              <BuiltinSkillRow
                key={skill.key}
                organizationId={organizationId}
                skill={skill}
                bots={bots}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Custom Skills"
        description="Your own instructions, run on one email at a time."
        toolbar={
          <Button className="h-8.5 rounded-lg" onClick={() => setOpenAdd(true)}>
            <IconPlus />
            <span>Add</span>
          </Button>
        }
      >
        {isPending ? (
          loading
        ) : custom.length === 0 ? (
          <EmptyState
            title="No custom skills yet"
            description="Add one to have the AI extract dates, translate, list tasks, or anything else you do often."
          />
        ) : (
          <ul className="divide-y">
            {custom.map((skill) => (
              <CustomSkillRow
                key={skill.key}
                organizationId={organizationId}
                skill={skill}
                bots={bots}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      <AddSkillForm organizationId={organizationId} open={openAdd} onOpenChange={setOpenAdd} />
    </div>
  )
}
