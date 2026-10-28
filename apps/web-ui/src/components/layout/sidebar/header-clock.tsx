import React from 'react'

import { useTimezone } from '@/hooks/use-timezone'
import { timezoneOffset } from '@/lib/constants/timezones'

/** Formats a moment in a zone, in UTC when this browser doesn't know the zone. */
function format(now: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(now)
  }
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
    year: 'numeric',
  })
  const time = format(now, timeZone, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  return (
    <div
      className="ms-auto flex items-center gap-2 rounded-full border py-1 ps-3 pe-1 text-sm"
      aria-label={`${date}, ${time}, ${timeZone}`}
      role="timer"
      aria-live="off"
    >
      <span className="text-muted-foreground hidden sm:inline">{date}</span>
      <span className="font-medium tabular-nums">{time}</span>
      <span className="bg-muted text-muted-foreground hidden rounded-full px-2 py-0.5 text-xs md:inline">
        {timeZone} | {timezoneOffset(timeZone, now)}
      </span>
    </div>
  )
}
