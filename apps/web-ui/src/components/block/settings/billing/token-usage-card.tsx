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
    <div className="bg-muted grid gap-1.5 rounded-lg p-2 px-2.25">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-semibold text-muted-foreground">AI tokens</span>
        <span className="text-ink-3 font-mono text-[10.5px] whitespace-nowrap tabular-nums">
          {formatTokens(quota.used_tokens)}
          {limit !== null && ` / ${formatTokens(limit)}`}
        </span>
      </div>
      {limit !== null && <UsageBar used={quota.used_tokens} limit={limit} />}
    </div>
  )
}
