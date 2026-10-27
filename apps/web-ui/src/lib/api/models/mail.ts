import type { ISO8601DateString } from '@/types/time'

export type MailFolder = 'inbox' | 'archive' | 'sent' | 'drafts' | 'spam' | 'trash'
/** The folders a user may move a mail to. */
export type MailMoveTarget = 'inbox' | 'archive' | 'spam' | 'trash'
export type MailImportance = 'important' | 'low_priority' | 'broadcast'

export interface MailContact {
  name: string
  email: string
}

/** A mail synced from IMAP. Lists carry `teaser`, a single mail `body`. */
export interface Mail {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  email_account_id: string
  folder: MailFolder
  message_id: string
  from_name: string
  from_email: string
  to: MailContact[]
  cc: MailContact[]
  subject: string
  body?: string
  /** The text/html part; "" when the mail has none, absent in lists. */
  body_html?: string | null
  teaser?: string
  received_at: ISO8601DateString
  is_read: boolean
  is_starred: boolean
  /** null until the AI or the user classifies the mail. */
  importance: MailImportance | null
  importance_by: 'ai' | 'user' | null
  /** The AI summary, kept after the first request; null until then and in lists. */
  summary?: string | null
}
