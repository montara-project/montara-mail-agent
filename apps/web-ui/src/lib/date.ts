/** "Oct 30", or "Oct 30, 2026" with `year`. */
export const monthDay = (date: Date, year = false) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: year ? 'numeric' : undefined,
  })

/** The 24-hour time, "14:21"; `separator` swaps the colon, e.g. "14.21". */
export const clock = (date: Date, separator = ':') =>
  date
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .replace(':', separator)

/** "14:21" today, then "Yesterday", a weekday within the week, and "Oct 30" after that. */
export function shortDay(date: Date) {
  const midnight = (day: Date) =>
    new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const days = Math.round((midnight(new Date()) - midnight(date)) / 86400000)
  if (days === 0) return clock(date)
  if (days === 1) return 'Yesterday'
  if (days > 1 && days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })
  return monthDay(date)
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "5 minutes ago", "in 2 days": the distance from now in its largest whole unit. */
export function timeAgo(date: Date) {
  const seconds = (date.getTime() - Date.now()) / 1000
  const [unit, size] = UNITS.find(([, size]) => Math.abs(seconds) >= size) ?? ['second', 1]
  return relative.format(Math.trunc(seconds / size), unit)
}

/** How much of the span from `start` to `end` has run, as a whole percent from 0 to 100. */
export function elapsedPercent(start: Date, end: Date) {
  const span = end.getTime() - start.getTime()
  if (span <= 0) return 100
  return Math.min(100, Math.max(0, Math.round(((Date.now() - start.getTime()) / span) * 100)))
}

/** Whether `date` has already gone by. */
export const isPast = (date: Date) => date.getTime() < Date.now()
