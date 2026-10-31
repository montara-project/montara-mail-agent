import { Badge } from '@/components/ui/badge'

type TopupStatus = 'pending' | 'paid' | 'expired' | 'failed'

const statusVariant: Record<TopupStatus, 'success' | 'secondary' | 'destructive'> = {
  paid: 'success',
  pending: 'secondary',
  expired: 'secondary',
  failed: 'destructive',
}

/** A top-up's status, the same on the billing page and its invoice. */
export default function TopupStatusBadge({ status }: { status: TopupStatus }) {
  return (
    <Badge variant={statusVariant[status]} appearance="light" size="sm" className="capitalize">
      {status}
    </Badge>
  )
}
