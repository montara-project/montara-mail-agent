import { cn } from '@/lib/utils'

/** The statuses the app reports, each with its color token (styles.css). */
export type StatusKey = 'synced' | 'healthy' | 'pending' | 'failed' | 'offline' | 'disconnected'

const STATUS_COLOR: Record<StatusKey, string> = {
  synced: 'var(--success)',
  healthy: 'var(--success)',
  pending: 'var(--warning)',
  failed: 'var(--destructive)',
  offline: 'var(--ink-3)',
  disconnected: 'var(--ink-3)',
}

/** A small status dot with a label; the color carries the meaning. */
export default function StatusDot({
  status,
  label,
  className,
}: {
  status: StatusKey
  /** Shown beside the dot; defaults to the status, capitalized. */
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-muted-foreground inline-flex items-center gap-1.5 text-xs whitespace-nowrap',
        className
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_COLOR[status] }}
      />
      {label ?? status[0].toUpperCase() + status.slice(1)}
    </span>
  )
}
