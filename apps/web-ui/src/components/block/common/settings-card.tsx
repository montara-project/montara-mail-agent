import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** The centered column of a Control Center, Dashboard or Account page. */
export function SettingsPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-[880px] grid-cols-[minmax(0,1fr)] gap-7 pt-2 pb-6">
      {children}
    </div>
  )
}

/**
 * The icon tile's hue, by what the card is about, so a color means one thing
 * across the Control Center: violet the AI, blue mail and the workspace, green
 * account security, amber blocking, red deletion. Light themes take the darker
 * text tokens, which keep the icon at 3:1 or more on its tint.
 */
const TONES = {
  ai: 'border-accent-ink/25 bg-accent-ink/12 text-accent-soft',
  info: 'border-info/25 bg-info/12 text-info',
  success: 'border-success/25 bg-success/12 text-success-text',
  warning: 'border-warning/25 bg-warning/12 text-warning-text',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive',
} as const

/**
 * The Control Center card, after the Audit log: an icon and titles above a
 * divider, with an optional count and action beside them, then the body and an
 * optional footer. The body is inset rows by default; `form` pads it for fields
 * and `flush` leaves the padding to the content.
 */
export function SettingsCard({
  icon: Icon,
  tone,
  title,
  description,
  count,
  noun,
  action,
  footer,
  body = 'list',
  children,
}: {
  icon: LucideIcon
  tone: keyof typeof TONES
  title: string
  description?: React.ReactNode
  /** Leaves out the chip when there is nothing to count. */
  count?: number
  /** What the chip counts, already singular or plural. */
  noun?: string
  /** The card's own control, beside the count. */
  action?: React.ReactNode
  footer?: React.ReactNode
  body?: 'list' | 'form' | 'flush'
  children: React.ReactNode
}) {
  return (
    <Card className="rounded-lg shadow-none">
      <div className="border-input flex flex-wrap items-center justify-between gap-x-2.5 gap-y-2 border-b px-4 py-3.5">
        <div className="flex min-w-0 flex-1 basis-52 items-center gap-3">
          {/* As tall as the title and description together (18 + 4 + 15px). */}
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-[9px] border',
              TONES[tone]
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="grid min-w-0 gap-1">
            <h3 className="text-[13.5px] leading-[18px] font-bold">{title}</h3>
            {description && (
              <p className="text-ink-3 text-[11px] leading-[15px] text-pretty">{description}</p>
            )}
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
      <div
        className={cn(
          body === 'list' && 'grid gap-0.5 px-2.5 pt-3 pb-2.5',
          body === 'form' && 'grid gap-3.5 p-4'
        )}
      >
        {children}
      </div>
      {footer && (
        <div className="border-input flex flex-wrap items-center justify-between gap-2 border-t px-4 py-[11px]">
          {footer}
        </div>
      )}
    </Card>
  )
}
