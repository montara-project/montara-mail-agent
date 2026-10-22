import { format as formatDateFn } from 'date-fns'

/**
 * Format date using date-fns
 * @param date - Date to format
 * @param formatStr - Format string (default: 'dd/MM/yyyy')
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  formatStr?: string
): string {
  if (!date) return '-'
  return formatDateFn(date, formatStr || 'dd/MM/yyyy')
}

/**
 * Format date with time (dd/MM/yyyy, HH:mm:ss)
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  return formatDate(date, 'dd/MM/yyyy, HH:mm:ss')
}
