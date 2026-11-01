import { useQuery } from '@tanstack/react-query'

import { useMailAccounts } from '@/components/layout/mail/mail-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

/** The little mark beside a stat's label; decorative, so hidden from readers. */
function Mark({ className }: { className?: string }) {
  return <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', className)} />
}

/** One stat: label + mark, the number, and a note under it in the faint ink. */
function StatCard({
  label,
  mark,
  value,
  note,
}: {
  label: string
  mark: string
  value: number | undefined
  note: React.ReactNode
}) {
  return (
    <div className="bg-card border-border/60 shadow-hairline grid gap-1.5 rounded-lg border p-3.5">
      <div className="text-muted-foreground flex items-center justify-between text-xs font-semibold">
        <span>{label}</span>
        <Mark className={mark} />
      </div>
      {value === undefined ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <span className="text-2xl font-bold tabular-nums">{value}</span>
      )}
      <span className="text-ink-3 truncate text-[11px]">{note}</span>
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

  if (isError) {
    return <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
  }

  return (
    <section aria-label="Mail overview" aria-busy={isPending} className="grid gap-3 sm:grid-cols-3">
      <StatCard
        label="Unread"
        mark="bg-foreground"
        value={data?.unread}
        note={
          data?.accounts === undefined ? (
            <Skeleton className="h-3 w-28" />
          ) : (
            `across ${data.accounts} ${data.accounts === 1 ? 'account' : 'accounts'}`
          )
        }
      />
      <StatCard label="Spam" mark="bg-warning" value={data?.spam} note="held for review" />
      <StatCard
        label="Accounts"
        mark="bg-success"
        value={data?.accounts}
        note={failing > 0 ? `${failing} need attention` : 'all connections healthy'}
      />
    </section>
  )
}
