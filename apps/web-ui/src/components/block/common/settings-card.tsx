import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** The centered column of one Control Center page: its heading above its cards. */
export function SettingsPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[880px] grid-cols-[minmax(0,1fr)] gap-7 pt-2 pb-6">
      {children}
    </div>
  )
}

/** A Control Center card: its title, description and action above a divider, then its body. */
export function SettingsCard({
  title,
  description,
  action,
  dense,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  /** The tighter head and body some pages' cards use. */
  dense?: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="rounded-lg shadow-none">
      <div
        className={cn(
          'flex items-center justify-between gap-3 border-b px-[18px]',
          dense ? 'pt-3.5 pb-[13px]' : 'pt-4 pb-[15px]'
        )}
      >
        <div className={cn('grid min-w-0 flex-1', dense ? 'gap-[3px]' : 'gap-1')}>
          <h3 className="text-[13.5px] leading-[18px] font-bold">{title}</h3>
          {description && <p className="text-ink-3 text-[11.5px] leading-4">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('grid p-[18px]', dense ? 'gap-3' : 'gap-3.5')}>{children}</div>
    </Card>
  )
}

/**
 * A Control Center card holding a list: an icon and titles beside a count, the
 * rows edge to edge below a divider, and an optional footer.
 */
export function SettingsListCard({
  icon: Icon,
  title,
  description,
  count,
  noun,
  action,
  footer,
  children,
}: {
  icon: LucideIcon
  title: string
  description: string
  /** Leaves out the chip when there is nothing to count. */
  count?: number
  /** What the chip counts, already singular or plural. */
  noun?: string
  /** The card's own control, beside the count. */
  action?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="rounded-lg shadow-none">
      <div className="border-input flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2 border-b px-4 py-3.5">
        <div className="flex min-w-0 flex-1 basis-52 items-center gap-[9px]">
          <Icon className="text-ink-3 size-[13px] shrink-0" aria-hidden />
          <div className="grid min-w-0 gap-1">
            <h3 className="text-[13.5px] leading-[18px] font-bold">{title}</h3>
            <p className="text-ink-3 text-[11px] leading-[15px]">{description}</p>
          </div>
        </div>
        {(!!count || action) && (
          <div className="flex shrink-0 items-center gap-2">
            {!!count && (
              <span className="bg-muted text-ink-3 flex shrink-0 items-center gap-1 rounded-chip border px-[7px] py-1 text-[11px] leading-[15px]">
                <span className="text-muted-foreground font-bold tabular-nums">{count}</span>
                {noun}
              </span>
            )}
            {action}
          </div>
        )}
      </div>
      <div className="px-2.5 pt-3 pb-2.5">{children}</div>
      {footer && (
        <div className="border-input flex flex-wrap items-center justify-between gap-2 border-t px-4 py-[11px]">
          {footer}
        </div>
      )}
    </Card>
  )
}
