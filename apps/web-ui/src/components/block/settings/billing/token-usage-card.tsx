import { useQuery } from '@tanstack/react-query'

import UsageBar from '@/components/block/settings/billing/usage-bar'
import { queries } from '@/lib/api/queries'
import { formatTokens } from '@/lib/string'

/** This week's tokens against the plan's allowance; hidden until they are known. */
export default function TokenUsageCard() {
  const { data: quota } = useQuery(queries.quota.status())
  if (!quota) return null
  const limit = quota.limit_tokens

  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">Token usage</span>
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {formatTokens(quota.used_tokens)}
          {limit !== null && ` / ${formatTokens(limit)}`}
        </span>
      </div>
      {limit !== null && <UsageBar used={quota.used_tokens} limit={limit} />}
    </div>
  )
}
