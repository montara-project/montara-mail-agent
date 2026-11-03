import { cn } from '@/lib/utils'

/** The week's AI tokens against the allowance, in the AI accent. Decorative: the numbers sit beside it. */
export default function UsageBar({
  used,
  limit,
  className,
}: {
  used: number
  limit: number
  /** The track's size override; the billing page's bar is thicker. */
  className?: string
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  return (
    <div
      aria-hidden="true"
      className={cn('bg-secondary h-[3px] overflow-hidden rounded-[2px]', className)}
    >
      <div
        className={cn('h-full rounded-[2px]', percent >= 100 ? 'bg-destructive' : 'bg-accent-ink')}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
