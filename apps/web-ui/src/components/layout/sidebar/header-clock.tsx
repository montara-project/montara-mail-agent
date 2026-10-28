import React from 'react'

import { useTimezone } from '@/hooks/use-timezone'
import { timezoneOffset } from '@/lib/constants/timezones'

/**
 * The time now in the user's timezone, ticking each second, with the zone
 * and its offset beside it. Only this component re-renders on the tick.
 */
export default function HeaderClock() {
  const timeZone = useTimezone()
  const [now, setNow] = React.useState(() => new Date())

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  let time: string
  try {
    time = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).format(now)
  } catch {
    // A zone this browser doesn't know: show UTC rather than nothing.
    time = now.toISOString().slice(11, 19)
  }

  return (
    <div
      className="ms-auto flex items-center gap-2 rounded-full border py-1 ps-3 pe-1 text-sm"
      aria-label={`Current time ${time}, ${timeZone}`}
      role="timer"
      aria-live="off"
    >
      <span className="text-muted-foreground hidden sm:inline">Time</span>
      <span className="font-medium tabular-nums">{time}</span>
      <span className="bg-muted text-muted-foreground hidden rounded-full px-2 py-0.5 text-xs md:inline">
        {timeZone} | {timezoneOffset(timeZone, now)}
      </span>
    </div>
  )
}
