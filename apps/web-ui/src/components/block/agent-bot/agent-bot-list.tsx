import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Bot,
  ChartColumn,
  Inbox,
  Plus,
  Sparkles,
  SquarePen,
  Trash2,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { AddAgentBotForm, EditAgentBotForm } from '@/components/block/agent-bot/agent-bot-form'
import SectionHeading from '@/components/block/common/section-heading'
import { SettingsListCard, SettingsPage } from '@/components/block/common/settings-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

/** Where the bot rules are documented, next to the steps that describe them. */
const DOCS_URL = 'https://docs.montaramail.web.id/bots-and-skills'

/** What a bot does once it exists: the shape of the feature, shown before any is made. */
const STEPS = [
  {
    title: 'Watch a mailbox',
    description: 'Pick one or several accounts and the labels that matter.',
    icon: Inbox,
    step: '01',
    accent: false,
  },
  {
    title: 'Apply a rule',
    description: 'Describe it in a sentence. The agent proposes actions you approve.',
    icon: Sparkles,
    step: '02',
    accent: true,
  },
  {
    title: 'Report back',
    description: 'A weekly digest of what was archived, labeled or drafted.',
    icon: ChartColumn,
    step: '03',
    accent: false,
  },
] as const

/** One bot: its name and description, the default badge, and its two actions. */
function AgentBotRow({ record }: { record: Models.AgentBot }) {
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openDelete, setOpenDelete] = React.useState(false)
  const deleteMutation = useMutation(queries.agentBots.delete())

  return (
    <li className="hover:border-input hover:bg-popover flex flex-wrap items-center gap-x-[11px] gap-y-2 rounded-[9px] border border-transparent px-[9px] py-2 transition-colors duration-150 motion-reduce:transition-none">
      {/* A bot is an AI thing, so its tile carries the AI accent. */}
      <span className="bg-accent-tint text-accent-soft grid size-7 shrink-0 place-items-center rounded-[8px]">
        <Bot className="size-[13px]" aria-hidden />
      </span>
      <div className="grid min-w-0 flex-1 basis-[calc(100%-39px)] gap-px sm:basis-0">
        <p className="text-[12.5px] leading-[17px] font-semibold wrap-anywhere">{record.name}</p>
        {record.description && (
          <p className="text-ink-3 text-[10.5px] leading-[14px] text-pretty">
            {record.description}
          </p>
        )}
      </div>
      {record.is_default && (
        <Badge variant="secondary" appearance="light" size="sm" className="shrink-0">
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
        onConfirm={async () => {
          try {
            await deleteMutation.mutateAsync(record.id)
            toast.success('Agent bot deleted successfully')
            setOpenDelete(false)
          } catch (error) {
            toastAxiosError(error)
          }
        }}
        confirmText="Delete"
        variant="destructive"
      />
      <EditAgentBotForm open={openEdit} onOpenChange={setOpenEdit} record={record} />
    </li>
  )
}

/** The three steps, in the order a bot runs them; the second carries the accent. */
function WhatABotDoes() {
  return (
    <ul className="grid gap-0.5">
      {STEPS.map((step) => (
        <li
          key={step.step}
          className={
            step.accent
              ? 'bg-popover border-input flex flex-wrap items-center gap-x-[11px] gap-y-2 rounded-[9px] border px-2.5 py-2'
              : 'flex flex-wrap items-center gap-x-[11px] gap-y-2 rounded-[9px] px-2.5 py-2'
          }
        >
          <span
            className={
              step.accent
                ? 'bg-accent-tint text-accent-ink grid size-7 shrink-0 place-items-center rounded-[8px]'
                : 'bg-muted text-ink-2 grid size-7 shrink-0 place-items-center rounded-[8px]'
            }
          >
            <step.icon className="size-[13px]" aria-hidden />
          </span>
          <span className="grid min-w-0 flex-1 basis-[calc(100%-39px)] gap-px sm:basis-0">
            <span className="text-[12px] leading-4 font-semibold">{step.title}</span>
            <span className="text-ink-3 text-[10.5px] leading-[14px] text-pretty">
              {step.description}
            </span>
          </span>
          <span
            className={
              step.accent
                ? 'bg-accent-tint text-accent-ink rounded-[5px] px-1.5 py-[3px] font-mono text-[9px] leading-3 font-semibold'
                : 'bg-muted text-ink-faint rounded-[5px] px-1.5 py-[3px] font-mono text-[9px] leading-3 font-semibold'
            }
          >
            {step.step}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Shaped like the rows it stands in for. */
function Loading() {
  return (
    <div className="grid gap-0.5">
      {[0, 1].map((index) => (
        <div key={index} className="flex items-center gap-x-[11px] px-[9px] py-2">
          <Skeleton className="size-7 rounded-[8px]" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** An organization's agent bots: the personas the mail agent can speak as. */
export default function AgentBotList({ organizationId }: { organizationId: string }) {
  const [openAdd, setOpenAdd] = React.useState(false)
  const { data, isPending } = useQuery(queries.agentBots.list(organizationId))
  const bots = data?.data ?? []
  const noun = bots.length === 1 ? 'bot' : 'bots'

  return (
    <SettingsPage>
      <SectionHeading
        title="Agent Bots"
        description="Automations that read your mail and act on your rules while you're away."
      />

      <div className="grid gap-5">
        <SettingsListCard
          icon={Bot}
          title="Your agent bots"
          description="Personas the AI assistant can speak as"
          count={bots.length || undefined}
          noun={bots.length ? noun : undefined}
          action={
            <Button
              variant="outline"
              className="bg-muted border-border h-7 gap-1.5 px-[11px] text-[11px] font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-[11px]"
              onClick={() => setOpenAdd(true)}
            >
              <Plus />
              Add bot
            </Button>
          }
        >
          {isPending ? (
            <Loading />
          ) : bots.length === 0 ? (
            <div className="grid justify-items-center gap-2 py-6 text-center">
              <span className="bg-muted grid size-9 place-items-center rounded-[10px]">
                <Bot className="text-ink-3 size-4" aria-hidden />
              </span>
              <p className="text-[12.5px] leading-[17px] font-semibold">No agent bots yet</p>
              <p className="text-ink-3 text-[11px] leading-[15px]">
                Add a bot to give the assistant its own soul, memory, style and instructions.
              </p>
            </div>
          ) : (
            <ul className="grid gap-0.5">
              {bots.map((bot) => (
                <AgentBotRow key={bot.id} record={bot} />
              ))}
            </ul>
          )}
        </SettingsListCard>

        <SettingsListCard
          icon={Bot}
          title="What a bot will do"
          description="The shape of the feature, so you know what to expect"
          count={STEPS.length}
          noun="steps"
          footer={
            <>
              <p className="text-ink-3 flex items-start gap-[5px] text-[10.5px] leading-[14px]">
                Every action needs your approval before it runs
              </p>
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 pointer-coarse:h-11 inline-flex items-center gap-1 rounded-[5px] text-[10.5px] leading-[14px] font-semibold outline-none transition-colors duration-150 focus-visible:ring-[3px] motion-reduce:transition-none"
              >
                See an example
                <ArrowUpRight className="size-[11px]" aria-hidden />
              </a>
            </>
          }
        >
          <WhatABotDoes />
        </SettingsListCard>
      </div>

      <AddAgentBotForm organizationId={organizationId} open={openAdd} onOpenChange={setOpenAdd} />
    </SettingsPage>
  )
}
