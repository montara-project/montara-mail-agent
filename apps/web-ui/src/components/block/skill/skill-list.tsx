import { IconPlus } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  FileText,
  Handshake,
  Languages,
  Newspaper,
  PenLine,
  RefreshCw,
  Reply,
  Send,
  SpellCheck,
  Tags,
  Wand2,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import RowColumnAction from '@/components/block/common/row-column-action'
import SectionCard from '@/components/block/common/section-card'
import SectionHeading from '@/components/block/common/section-heading'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { botOptions, fromBotSelect, toBotSelect } from './skill-bot'
import { AddSkillForm, EditSkillForm } from './skill-form'

/** The built-in skills' icons, also used by the reader's Skills menu. */
export const SKILL_ICONS: Record<string, typeof Wand2> = {
  summarize: FileText,
  organize: Tags,
  draft_reply: Reply,
  humanize: PenLine,
  copy_edit: SpellCheck,
  prospect_reply: Send,
  objection_reply: Handshake,
  press_reply: Newspaper,
  translate: Languages,
  translate_reply: Languages,
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
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-ink/10 text-accent-ink">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-48 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {skill.name}
          {skill.target === 'draft' && (
            <Badge variant="secondary" appearance="light">
              Your draft
            </Badge>
          )}
        </p>
        <p className="text-muted-foreground text-xs">{skill.description}</p>
      </div>
      {/* On a phone the controls wrap under the text, not the icon. */}
      <div className="ms-11 flex basis-full items-center gap-3 sm:ms-0 sm:basis-auto">
        <Select
          value={toBotSelect(skill.agent_bot_id)}
          onValueChange={(value) => change({ agent_bot_id: fromBotSelect(value) })}
          indicatorPosition="right"
        >
          <SelectTrigger
            className="h-8 flex-1 sm:w-52 sm:flex-none"
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
        <Switch
          size="sm"
          // The switch role already says on or off; the name stays the skill's.
          aria-label={skill.name}
          // A 44px hit area around the small switch, for touch.
          className="after:absolute after:-inset-3 after:content-['']"
          checked={skill.is_enabled}
          disabled={save.isPending}
          onCheckedChange={(on) => change({ is_enabled: on })}
        />
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
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-ink/10 text-accent-ink">
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
  const { data, isPending, isError, error, refetch } = useQuery(
    queries.agentSkills.list(organizationId)
  )
  const bots = useQuery(queries.agentBots.list(organizationId)).data?.data ?? []
  const skills = data?.data ?? []
  const builtin = skills.filter((skill) => skill.builtin)
  const custom = skills.filter((skill) => !skill.builtin)

  // Shaped like the rows it stands in for, so the list doesn't jump when it lands.
  const loading = (rows: number) => (
    <div className="grid gap-5 py-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-lg" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )

  const builtinContent = () => {
    if (isPending) return loading(5)
    if (isError) {
      return (
        <div role="alert" className="grid justify-items-center gap-3 p-6 text-center text-sm">
          <p className="text-destructive">{axiosErrorMessage(error)}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw />
            Try again
          </Button>
        </div>
      )
    }
    return (
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
    )
  }

  const customContent = () => {
    if (isPending) return loading(2)
    if (custom.length === 0) {
      return (
        <EmptyState
          title="No custom skills yet"
          description="Add one to have the AI extract dates, translate, list tasks, or anything else you do often."
        />
      )
    }
    return (
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
    )
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <SectionHeading
          title="Skills"
          description="What the AI can do with an email, from the Skills menu in the reader or as a / command in the assistant. Skills marked Your draft rewrite the reply you are writing, from its Use AI menu. A skill with no bot of its own runs as the bot the user picked. Only the organization's owner can change them."
        />
        <SectionCard>
          {builtinContent()}
          {!isError && (
            <p className="text-muted-foreground mt-3 text-xs">
              Humanize is adapted from{' '}
              <a
                className="underline underline-offset-2"
                href="https://github.com/blader/humanizer"
                target="_blank"
                rel="noreferrer"
              >
                humanizer
              </a>{' '}
              by Siqi Chen. Copy edit, Reply to a prospect, Handle an objection and Reply to press
              are adapted from{' '}
              <a
                className="underline underline-offset-2"
                href="https://github.com/coreyhaines31/marketingskills"
                target="_blank"
                rel="noreferrer"
              >
                marketingskills
              </a>{' '}
              by Corey Haines. Both are MIT licensed.
            </p>
          )}
        </SectionCard>
      </section>

      {/* With the list failed, the error above stands for both sections. */}
      {!isError && (
        <section className="grid gap-3">
          <SectionHeading
            title="Custom Skills"
            description="Your own instructions, run on one email at a time."
            action={
              <Button className="h-8.5 rounded-lg" onClick={() => setOpenAdd(true)}>
                <IconPlus />
                <span>Add</span>
              </Button>
            }
          />
          <SectionCard>{customContent()}</SectionCard>
        </section>
      )}

      <AddSkillForm organizationId={organizationId} open={openAdd} onOpenChange={setOpenAdd} />
    </div>
  )
}
