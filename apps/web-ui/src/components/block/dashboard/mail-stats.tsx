import { useQuery } from '@tanstack/react-query'
import { Mail, OctagonAlert, PlugZap } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

/** Totals across every account of the active organization. */
export default function MailStats() {
  const { organization } = useActiveOrganization()
  const { data, isPending, isError, error } = useQuery(
    queries.organizations.stats(organization?.id)
  )

  const stats = [
    { label: 'Unread', value: data?.unread, icon: Mail },
    { label: 'Spam', value: data?.spam, icon: OctagonAlert },
    { label: 'Accounts connected', value: data?.accounts, icon: PlugZap },
  ]

  if (isError) {
    return <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
  }

  return (
    <section aria-label="Mail overview" aria-busy={isPending} className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card grid gap-2 rounded-xl border p-4 text-sm">
          <div className="text-muted-foreground flex items-center justify-between">
            <span>{stat.label}</span>
            <stat.icon className="size-4" />
          </div>
          {stat.value === undefined ? (
            <Skeleton className="h-9 w-12" />
          ) : (
            <span className="text-3xl font-semibold tabular-nums">{stat.value}</span>
          )}
        </div>
      ))}
    </section>
  )
}
