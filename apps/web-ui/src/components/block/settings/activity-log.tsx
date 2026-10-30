import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Dot,
  Forward,
  LogIn,
  type LucideIcon,
  Plug,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  Unplug,
  User,
} from 'lucide-react'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { activityLogQueries } from '@/lib/api/queries/activity-log'
import { clock, monthDay } from '@/lib/date'

interface ActivityLogListProps {
  title: string
  description: string
  /** Given, the list shows that organization's entries; else the user's own. */
  organizationId?: string
}

// The icon an entry carries, by its exact action; the area's icon covers the
// rest.
const ACTION_ICONS: Partial<Record<Models.ActivityAction, LucideIcon>> = {
  'auth.sign_in': LogIn,
  'profile.updated': User,
  'password.changed': ShieldCheck,
  'email_account.connected': Plug,
  'email_account.disconnected': Unplug,
  'mail.sent': Send,
  'mail.replied': Undo2,
  'mail.forwarded': Forward,
  'mail.deleted': Trash2,
}

// The badge an entry carries, by its action's area (the word before the dot).
const AREA_LABELS: Record<string, string> = {
  auth: 'Sign-in',
  profile: 'Account',
  password: 'Security',
  organization: 'Organization',
  email_account: 'Mailbox',
  mail: 'Mail',
}

function ActivityRow({ entry, showActor }: { entry: Models.ActivityLog; showActor: boolean }) {
  const Icon = ACTION_ICONS[entry.action] ?? Dot
  const area = entry.action.split('.')[0]
  const actor = entry.actor_name || 'Unknown'

  return (
    <li className="flex items-start gap-3 py-3">
      <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.description}</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {showActor ? `${actor} · ` : ''}
          {`${monthDay(new Date(entry.created_at), true)} ${clock(new Date(entry.created_at))}`}
          {entry.ip ? ` · from ${entry.ip}` : ''}
        </p>
      </div>
      <Badge variant="secondary" appearance="light" className="shrink-0">
        {AREA_LABELS[area] ?? entry.action}
      </Badge>
    </li>
  )
}

/**
 * The activity log: what happened, newest first, one page at a time with a
 * load-more button. Without an organization it lists the signed-in user's
 * own actions; with one, the organization's — actor names shown.
 */
export default function ActivityLogList({
  title,
  description,
  organizationId,
}: ActivityLogListProps) {
  const query = useInfiniteQuery(activityLogQueries.infinite(organizationId))
  const entries = query.data?.pages.flatMap((page) => page.data) ?? []

  const content = () => {
    if (query.isPending) {
      return (
        <div className="grid gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
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
      <>
        <ul className="divide-y">
          {entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} showActor={!!organizationId} />
          ))}
        </ul>
        {query.hasNextPage && (
          <div className="pt-3 text-center">
            <Button
              mode="link"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </>
    )
  }

  return (
    <SectionCard title={title} description={description}>
      {content()}
    </SectionCard>
  )
}
