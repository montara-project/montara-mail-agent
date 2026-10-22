import { useQuery } from '@tanstack/react-query'

import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { formatDateTime } from '@/lib/date'

/** API liveness, polled by the health query. */
export default function HealthCard() {
  const { data, isLoading, isError, error } = useQuery(queries.health.get())

  return (
    <SectionCard title="API Health" description="GET /api/health, refreshed every 30 seconds.">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Checking...</p>
      ) : isError ? (
        <p className="text-sm text-destructive">{axiosErrorMessage(error)}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge variant={data?.status === 'ok' ? 'success' : 'destructive'}>{data?.status}</Badge>
          </dd>
          <dt className="text-muted-foreground">Database</dt>
          <dd>{data?.database}</dd>
          <dt className="text-muted-foreground">Version</dt>
          <dd>{data?.version}</dd>
          <dt className="text-muted-foreground">Checked at</dt>
          <dd>{formatDateTime(data?.timestamp)}</dd>
        </dl>
      )}
    </SectionCard>
  )
}
