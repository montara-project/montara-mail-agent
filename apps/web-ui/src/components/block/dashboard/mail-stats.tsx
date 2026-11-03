import { useQuery } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Mail, ShieldAlert, type LucideIcon } from 'lucide-react'

import { useMailAccounts } from '@/components/layout/mail/mail-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

/** One stat: label with its icon, the number, and a note under it in the faint ink. */
function StatCard({
  label,
  icon: Icon,
  mark,
  value,
  valueClassName,
  note,
}: {
  label: string
  icon: LucideIcon
  mark: string
  value: number | undefined
  valueClassName?: string
  note: React.ReactNode
}) {
  return (
    <div className="bg-card border-border/60 shadow-hairline grid gap-1.5 rounded-lg border p-3.5">
      <div className="text-muted-foreground flex items-center justify-between text-xs font-semibold">
        <span>{label}</span>
        <Icon aria-hidden className={cn('size-3.5 shrink-0', mark)} />
      </div>
      {value === undefined ? (
        <Skeleton className="h-[38px] w-12" />
      ) : (
        <span
          className={cn(
            'text-[28px] leading-[38px] font-bold tracking-[-0.4px] tabular-nums',
            valueClassName
          )}
        >
          {value}
        </span>
      )}
      <span className="text-ink-3 truncate text-[11px] leading-[15px]">{note}</span>
    </div>
  )
}

/** Totals across every account of the active organization. */
export default function MailStats() {
  const { organization } = useActiveOrganization()
  const { data, isPending, isError, error } = useQuery(
    queries.organizations.stats(organization?.id)
  )
  // The accounts themselves, so the note can tell healthy from failing ones.
  const { data: accounts } = useMailAccounts()
  const failing = accounts?.filter((account) => account.sync_error).length ?? 0
  const withUnread = accounts?.filter((account) => account.unread > 0).length ?? 0

  if (isError) {
    return <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
  }

  return (
    <section aria-label="Mail overview" aria-busy={isPending} className="grid gap-3 sm:grid-cols-3">
      <StatCard
        label="Unread"
        icon={Mail}
        mark="text-foreground"
        value={data?.unread}
        note={
          accounts === undefined ? (
            <Skeleton className="h-3 w-28" />
          ) : (
            `across ${withUnread} of ${accounts.length} ${accounts.length === 1 ? 'mailbox' : 'mailboxes'}`
          )
        }
      />
      <StatCard
        label="Quarantined"
        icon={ShieldAlert}
        mark="text-warning"
        value={data?.spam}
        valueClassName="text-warning-text"
        note="held for review"
      />
      <StatCard
        label="Accounts"
        icon={failing > 0 ? CircleAlert : CircleCheck}
        mark={failing > 0 ? 'text-warning' : 'text-success'}
        value={data?.accounts}
        note={failing > 0 ? `${failing} need attention` : 'all connections healthy'}
      />
    </section>
  )
}
