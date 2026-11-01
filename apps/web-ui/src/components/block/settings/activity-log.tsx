import { useInfiniteQuery } from '@tanstack/react-query'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { activityLogQueries } from '@/lib/api/queries/activity-log'
import { timeAgo } from '@/lib/date'

interface ActivityLogListProps {
  title: string
  description: string
  /** Given, the list shows that organization's entries; else the user's own. */
  organizationId?: string
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
  const area = entry.action.split('.')[0]
  const actor = entry.actor_name || 'Unknown'

  return (
    <li className="border-border/60 flex items-center gap-3 border-b py-2.5 last:border-b-0">
      <span className="size-1.5 shrink-0 rounded-full bg-ink-faint" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{entry.description}</p>
        <p className="text-ink-3 mt-0.5 truncate text-[10.5px]">
          {showActor ? `${actor} · ` : ''}
          {timeAgo(new Date(entry.created_at))}
          {entry.ip ? ` · from ${entry.ip}` : ''}
        </p>
      </div>
      <span className="bg-muted shrink-0 rounded-[5px] px-[7px] py-[3px] text-[10px] font-semibold text-muted-foreground">
        {AREA_LABELS[area] ?? entry.action}
      </span>
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
        <ul>
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
