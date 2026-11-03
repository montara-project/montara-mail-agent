import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Construction,
  FileText,
  Handshake,
  Languages,
  Newspaper,
  PenLine,
  Plus,
  RefreshCw,
  Reply,
  Send,
  Sparkles,
  SpellCheck,
  SquarePen,
  Tags,
  Trash2,
  Wand2,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SectionHeading from '@/components/block/common/section-heading'
import { SettingsCard, SettingsPage } from '@/components/block/common/settings-card'
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

/**
 * The built-in skills' icons, also used by the reader's Skills menu. */
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

/** The design's tiny mono tag, on the skills whose output lands in your draft. */
function DraftBadge() {
  return (
    <span className="bg-muted text-ink-faint rounded-[4px] px-[5px] py-px font-mono text-[8.5px] leading-3 font-semibold tracking-[0.4px] uppercase">
      Your draft
    </span>
  )
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
    <li
      className="hover:border-input hover:bg-popover flex flex-wrap items-center gap-x-[11px] gap-y-2 rounded-[9px] border border-transparent px-[9px] py-2 transition-colors duration-150 motion-reduce:transition-none"
      aria-busy={save.isPending}
    >
      <span className="bg-muted text-ink-2 grid size-7 shrink-0 place-items-center rounded-[8px]">
        <Icon className="size-[13px]" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 basis-[calc(100%-39px)] gap-px sm:basis-0">
        <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] leading-4 font-semibold">
          {skill.name}
          {skill.target === 'draft' && <DraftBadge />}
        </p>
        <p className="text-ink-3 text-[10.5px] leading-[14px] text-pretty">{skill.description}</p>
      </div>
      {/* On a phone the controls wrap under the text, not the icon. */}
      <div className="ms-11 flex basis-full items-center gap-[11px] sm:ms-0 sm:basis-auto">
        <Select
          value={toBotSelect(skill.agent_bot_id)}
          onValueChange={(value) => change({ agent_bot_id: fromBotSelect(value) })}
          indicatorPosition="right"
        >
          <SelectTrigger
            className="bg-muted border-border h-7 w-full flex-1 rounded-[7px] px-2 text-[10.5px] font-medium text-muted-foreground shadow-none pointer-coarse:h-11 sm:w-52 sm:max-w-52 sm:flex-none"
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
    <li className="hover:border-input hover:bg-popover flex flex-wrap items-center gap-x-[11px] gap-y-2 rounded-[9px] border border-transparent px-[9px] py-2 transition-colors duration-150 motion-reduce:transition-none">
      <div className="bg-muted text-ink-2 grid size-7 shrink-0 place-items-center rounded-[8px]">
        <Wand2 className="size-[13px]" aria-hidden />
      </div>
      <div className="grid min-w-0 flex-1 basis-[calc(100%-39px)] gap-px sm:basis-0">
        <p className="text-[12px] leading-4 font-semibold wrap-anywhere">{skill.name}</p>
        <p className="text-ink-3 text-[10.5px] leading-[14px] truncate">
          {skill.description || skill.instruction}
        </p>
      </div>
      {botName && (
        <Badge variant="secondary" appearance="light" size="sm" className="max-w-32 shrink-0">
          <span className="truncate">{botName}</span>
        </Badge>
      )}
      {!skill.is_enabled && (
        <Badge variant="secondary" appearance="outline" size="sm" className="shrink-0">
          Off
        </Badge>
      )}
      <Button
        variant="ghost"
        mode="icon"
        size="sm"
        className="shrink-0"
        aria-label={`Edit ${skill.name}`}
        onClick={() => setOpenEdit(true)}
      >
        <SquarePen />
      </Button>
      <Button
        variant="destructive"
        mode="icon"
        size="sm"
        className="shrink-0"
        aria-label={`Delete ${skill.name}`}
        onClick={() => setOpenDelete(true)}
      >
        <Trash2 />
      </Button>

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

/** Shaped like the rows it stands in for, so the list doesn't jump when it lands. */
function Loading({ rows }: { rows: number }) {
  return (
    <div className="grid gap-0.5">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-x-[11px] px-[9px] py-2">
          <Skeleton className="size-7 rounded-[8px]" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
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

  const builtinContent = () => {
    if (isPending) return <Loading rows={5} />
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
      <ul className="grid gap-0.5">
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
    if (isPending) return <Loading rows={2} />
    if (custom.length === 0) {
      // The design's empty state: a tile, the invitation, and its button.
      return (
        <div className="grid justify-items-center gap-2 py-6 text-center">
          <span className="bg-muted text-ink-2 grid size-11 place-items-center rounded-[11px]">
            <Construction className="size-5" aria-hidden />
          </span>
          <p className="text-[13px] leading-[18px] font-semibold">No custom skills yet</p>
          <p className="text-ink-3 max-w-96 text-[11.5px] leading-4 text-pretty">
            Add one to have the AI extract dates, translate, list tasks, or anything else you keep
            doing by hand.
          </p>
          <Button
            className="mt-1.5 h-7 gap-1.5 rounded-lg bg-foreground px-3 text-[11.5px] font-semibold text-background shadow-none hover:bg-foreground/90 pointer-coarse:h-11 [&_svg]:size-3"
            onClick={() => setOpenAdd(true)}
          >
            <Plus />
            <span>Create a skill</span>
          </Button>
        </div>
      )
    }
    return (
      <ul className="grid gap-0.5">
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
    <SettingsPage>
      <SectionHeading
        title="Skills"
        description="Reusable abilities the assistant can call. Enable only what you allow."
      />

      <div className="grid gap-5">
        <SettingsCard
          icon={Sparkles}
          tone="ai"
          title="Installed skills"
          description="Each skill runs under your own permissions"
          count={builtin.length || undefined}
          noun="built-in"
        >
          {builtinContent()}
          {!isError && (
            <p className="text-ink-faint mt-2 px-2.5 pb-1 text-[11px] leading-[15px] text-pretty">
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
        </SettingsCard>

        {/* With the list failed, the error above stands for both sections. */}
        {!isError && (
          <SettingsCard
            icon={Wand2}
            tone="ai"
            title="Custom skills"
            description="Your own instructions, run on one email at a time."
            count={custom.length}
            noun={custom.length === 1 ? 'skill' : 'skills'}
            action={
              <Button
                variant="outline"
                className="bg-muted border-border h-7 gap-1.5 rounded-lg px-3 text-[11.5px] font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-3"
                onClick={() => setOpenAdd(true)}
              >
                <Plus />
                <span>Add skill</span>
              </Button>
            }
          >
            {customContent()}
          </SettingsCard>
        )}
      </div>

      <AddSkillForm organizationId={organizationId} open={openAdd} onOpenChange={setOpenAdd} />
    </SettingsPage>
  )
}
