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

/** Whether `date` has already gone by. */
export const isPast = (date: Date) => date.getTime() < Date.now()
