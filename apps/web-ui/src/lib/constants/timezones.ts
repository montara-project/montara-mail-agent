/** The zone the app shows times in until the user picks one. */
export const DEFAULT_TIMEZONE = 'UTC'

/**
 * The IANA timezones the profile offers: UTC first, then the browser's own
 * list, by region. The server checks a pick against its own zone database.
 */
export const TIMEZONES = [
  DEFAULT_TIMEZONE,
  ...Intl.supportedValuesOf('timeZone').filter((zone) => zone !== DEFAULT_TIMEZONE),
]

/**
 * A zone's current offset from UTC, as "UTC+07:00". It follows daylight
 * saving, so it is worked out for a moment, now by default.
 */
export function timezoneOffset(timeZone: string, at = new Date()) {
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value
    // "GMT" alone is UTC itself; "GMT+07:00" is the rest.
    return !name || name === 'GMT' ? 'UTC+00:00' : name.replace('GMT', 'UTC')
  } catch {
    return 'UTC+00:00'
  }
}

/** "Asia/Jakarta" → "Asia/Jakarta (UTC+07:00)": how the timezone picker lists a zone. */
export const timezoneLabel = (timeZone: string) =>
  `${timeZone.replace(/_/g, ' ')} (${timezoneOffset(timeZone)})`
