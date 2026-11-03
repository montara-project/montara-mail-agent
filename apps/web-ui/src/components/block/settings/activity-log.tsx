import { useQuery } from '@tanstack/react-query'
import {
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  History,
  Inbox,
  KeyRound,
  LogIn,
  type LucideIcon,
  Mail,
  Plug,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  User,
} from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import { SettingsCard } from '@/components/block/common/settings-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { ACTIVITY_LOG_PAGE_SIZE, activityLogQueries } from '@/lib/api/queries/activity-log'
import { clock, monthDay, timeAgo } from '@/lib/date'
import { cn } from '@/lib/utils'

interface ActivityLogListProps {
  title: string
  description: string
  /** Given, the list shows that organization's entries; else the user's own. */
  organizationId?: string
}

// The tag an entry carries, by its action's area (the word before the dot);
// any other area shows the action itself.
const AREA_LABELS: Record<string, string> = {
  auth: 'Sign-in',
  profile: 'Account',
  organization: 'Organization',
  email_account: 'Mailbox',
  mail: 'Mail',
}

// An organization's audit log tags every entry in words, by its area too.
const AUDIT_LABELS: Record<string, string> = {
  email_account: 'Mailbox',
  mail: 'Mail',
  organization: 'Org',
  api_key: 'API',
  password: 'Security',
  ip_block: 'Security',
  profile: 'Account',
  auth: 'Sign-in',
  agent_bot: 'Agent',
  skill: 'Skill',
  mcp_server: 'MCP',
}

// An entry's icon, by its exact action first, then its area.
const ACTION_ICONS: Record<string, LucideIcon> = {
  'ip_block.added': ShieldAlert,
  'ip_block.removed': ShieldOff,
  auth: LogIn,
  password: KeyRound,
  api_key: KeyRound,
  '2fa': ShieldCheck,
  totp: ShieldCheck,
  profile: User,
  organization: Building2,
  email_account: Mail,
  mail: Inbox,
  agent_bot: Bot,
  skill: GraduationCap,
  mcp_server: Plug,
}

/** How many page numbers the footer shows at once. */
const PAGE_WINDOW = 5

function ActivityRow({ entry, audit }: { entry: Models.ActivityLog; audit: boolean }) {
  const area = entry.action.split('.')[0]
  const actor = entry.actor_name || 'Unknown'
  const { mask } = useHideEmails()
  const Icon = ACTION_ICONS[entry.action] ?? ACTION_ICONS[area] ?? History

  return (
    <li className="group/row hover:border-input hover:bg-popover flex flex-wrap items-center gap-x-[0.6875rem] gap-y-1.5 rounded-md border border-transparent px-[0.5625rem] py-2 transition-colors duration-150 motion-reduce:transition-none">
      <span className="bg-muted group-hover/row:bg-accent-ink/6 grid size-7 shrink-0 place-items-center rounded-[0.5rem]">
        <Icon
          className="text-muted-foreground group-hover/row:text-accent-soft size-[0.8125rem]"
          aria-hidden
        />
      </span>
      <div className="grid min-w-0 flex-1 basis-[calc(100%-2.4375rem)] gap-px sm:basis-0">
        <p className="text-ink-strong group-hover/row:text-foreground text-xs leading-4 font-medium wrap-anywhere">
          {mask(entry.description)}
        </p>
        <p className="text-ink-3 text-[0.71875rem] leading-[0.875rem]">
          {audit
            ? `${mask(actor)} · ${monthDay(new Date(entry.created_at))}, ${clock(new Date(entry.created_at))}`
            : timeAgo(new Date(entry.created_at))}
          {entry.ip ? ` · from ${entry.ip}` : ''}
        </p>
      </div>
      <span
        className={cn(
          'bg-muted text-muted-foreground group-hover/row:bg-secondary group-hover/row:text-foreground ms-[2.4375rem] rounded-tag px-1.5 py-[0.1875rem] text-[0.71875rem] font-semibold wrap-anywhere sm:ms-0 sm:shrink-0',
          audit ? 'leading-[0.875rem]' : 'font-mono leading-3'
        )}
      >
        {(audit ? AUDIT_LABELS[area] : AREA_LABELS[area]) ?? entry.action}
      </span>
    </li>
  )
}

/** Previous, up to five page numbers around the current one, next. */
function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
}) {
  const start = Math.max(0, Math.min(page - 2, pageCount - PAGE_WINDOW))
  const pages = Array.from({ length: Math.min(PAGE_WINDOW, pageCount) }, (_, i) => start + i)
  const cell =
    'grid size-6 shrink-0 place-items-center rounded-[0.4375rem] border border-transparent text-[0.75rem] outline-none transition-colors duration-150 focus-visible:ring-[0.1875rem] focus-visible:ring-ring/50 pointer-coarse:size-11 motion-reduce:transition-none'
  const arrow = cn(
    cell,
    'text-muted-foreground hover:bg-accent disabled:text-ink-faint disabled:hover:bg-transparent'
  )

  return (
    <nav aria-label="Activity log pages" className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className={arrow}
      >
        <ChevronLeft className="size-3" aria-hidden />
      </button>
      {pages.map((item) => (
        <button
          key={item}
          type="button"
          aria-label={`Page ${item + 1}`}
          aria-current={item === page ? 'page' : undefined}
          onClick={() => onChange(item)}
          className={cn(
            cell,
            item === page
              ? 'border-accent-ink/40 bg-accent-ink/6 text-accent-soft font-bold'
              : 'text-ink-3 hover:bg-accent font-medium'
          )}
        >
          {item + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
        className={arrow}
      >
        <ChevronRight className="size-3" aria-hidden />
      </button>
    </nav>
  )
}

/**
 * The activity log: what happened, newest first, one numbered page at a time.
 * Without an organization it lists the signed-in user's own actions; with one,
 * the organization's audit trail, actor names shown.
 */
export default function ActivityLogList({
  title,
  description,
  organizationId,
}: ActivityLogListProps) {
  const [page, setPage] = React.useState(0)
  const query = useQuery(activityLogQueries.page(page, organizationId))
  const entries = query.data?.data ?? []
  const total = query.data?.metadata.total ?? 0
  const pageCount = Math.ceil(total / ACTIVITY_LOG_PAGE_SIZE)
  const first = page * ACTIVITY_LOG_PAGE_SIZE
  // An organization's log is its audit trail: entries by whoever made them.
  const audit = !!organizationId
  const noun = (count: number) =>
    audit ? (count === 1 ? 'entry' : 'entries') : count === 1 ? 'event' : 'events'

  const content = () => {
    if (query.isPending) {
      return (
        <div className="grid gap-3 p-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      )
    }
    if (query.isError) {
      return (
        <div role="alert" className="grid justify-items-center gap-3 p-6 text-center text-sm">
          <p className="text-destructive">{axiosErrorMessage(query.error)}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      )
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          title="No activity yet"
          description="Actions will appear here as they happen."
        />
      )
    }
    return (
      <ul className="grid gap-0.5">
        {entries.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} audit={audit} />
        ))}
      </ul>
    )
  }

  return (
    <SettingsCard
      icon={History}
      tone="success"
      title={title}
      description={description}
      count={audit ? total : entries.length}
      noun={noun(audit ? total : entries.length)}
      footer={
        total > 0 && (
          <>
            <p className="text-ink-3 flex items-center gap-[0.3125rem] text-[0.71875rem] leading-[0.875rem]">
              Showing
              <span className="text-foreground font-bold tabular-nums">
                {first + 1}–{first + entries.length}
              </span>
              of {total} {noun(total)}
            </p>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </>
        )
      }
    >
      {content()}
    </SettingsCard>
  )
}
