import { Clock, Globe, Sun } from 'lucide-react'
import React from 'react'

import { useTimezone } from '@/hooks/use-timezone'
import { timezoneOffset } from '@/lib/constants/timezones'
import { cn } from '@/lib/utils'

/** Formats a moment in a zone, in UTC when this browser doesn't know the zone. */
function format(now: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(now)
  }
}

/** A quiet chip of the topbar's right side: hairline border, muted text, an icon. */
function ClockChip({
  icon: Icon,
  className,
  children,
}: {
  icon: typeof Sun
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'border-border/60 text-muted-foreground hidden h-7 items-center gap-1.5 rounded-chip border px-2.5 text-xs whitespace-nowrap sm:flex',
        className
      )}
    >
      <Icon className="text-ink-3 size-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  )
}

/**
 * Today's date and the time now in the user's timezone, ticking each second,
 * with the zone and its offset beside them. Only this component re-renders
 * on the tick.
 */
export default function HeaderClock() {
  const timeZone = useTimezone()
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // The date is the zone's too: it turns over at the zone's midnight.
  const date = format(now, timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const time = format(now, timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  return (
    <div
      className="ms-auto flex items-center gap-2"
      aria-label={`${date}, ${time}, ${timeZone}`}
      role="timer"
      aria-live="off"
    >
      <ClockChip icon={Sun}>{date}</ClockChip>
      <ClockChip icon={Clock}>
        <span className="tabular-nums">{time}</span>
      </ClockChip>
      <ClockChip icon={Globe} className="md:flex">
        <span className="truncate">{timeZone}</span>
        <span className="text-ink-3 tabular-nums">{timezoneOffset(timeZone, now)}</span>
      </ClockChip>
    </div>
  )
}
