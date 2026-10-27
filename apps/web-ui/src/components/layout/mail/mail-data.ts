import { format, isToday } from 'date-fns'

import type { Models } from '@/lib/api/models'

export function mailInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** Short date for the list: the time for today's mail, else the day. */
export function formatMailListDate(iso: string) {
  const date = new Date(iso)
  return isToday(date) ? format(date, 'HH.mm') : format(date, 'MMM d')
}

/** The sender's name, else their address. */
export function senderName(mail: Pick<Models.Mail, 'from_name' | 'from_email'>) {
  return mail.from_name || mail.from_email || 'Unknown sender'
}

export const IMPORTANCE_LABELS: Record<Models.MailImportance, string> = {
  important: 'Important',
  low_priority: 'Low priority',
  broadcast: 'Broadcast',
}
