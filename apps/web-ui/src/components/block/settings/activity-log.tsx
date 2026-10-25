import {
  IconArrowBackUp,
  IconLogin,
  IconMail,
  IconMailForward,
  IconPlugConnected,
  IconPlugConnectedX,
  IconPointFilled,
  IconSend,
  IconShieldLock,
  IconTrash,
  IconUser,
} from '@tabler/icons-react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { activityLogQueries } from '@/lib/api/queries/activity-log'

interface ActivityLogListProps {
  title: string
  description: string
  /** Given, the list shows that organization's entries; else the user's own. */
  organizationId?: string
}

// The icon an entry carries, by its exact action; the area's icon covers the
// rest.
const ACTION_ICONS: Partial<Record<Models.ActivityAction, typeof IconMail>> = {
  'auth.sign_in': IconLogin,
  'profile.updated': IconUser,
  'password.changed': IconShieldLock,
  'email_account.connected': IconPlugConnected,
  'email_account.disconnected': IconPlugConnectedX,
  'mail.sent': IconSend,
  'mail.replied': IconArrowBackUp,
  'mail.forwarded': IconMailForward,
  'mail.deleted': IconTrash,
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
  const Icon = ACTION_ICONS[entry.action] ?? IconPointFilled
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
          {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
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

  return (
    <SectionCard title={title} description={description}>
      {query.isPending ? (
        <div className="grid gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Actions will appear here as they happen."
        />
      ) : (
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
      )}
    </SectionCard>
  )
}
