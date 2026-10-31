import { cn } from '@/lib/utils'

/** The week's tokens against the allowance. Decorative: the numbers sit beside it. */
export default function UsageBar({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  return (
    <div aria-hidden="true" className="bg-muted h-2 overflow-hidden rounded-full">
      <div
        className={cn('h-full rounded-full', percent >= 100 ? 'bg-destructive' : 'bg-primary')}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
