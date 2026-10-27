import type { AxiosDeleteResponse, AxiosItemResponse } from '@/types/api'

import type { Models } from '../../models'

export type MailPatchBody = {
  is_read?: boolean
  is_starred?: boolean
  importance?: Models.MailImportance
}

export type MailForwardBody = {
  to: string[]
  note?: string
}

/** A reply as typed (Markdown) and as the HTML the editor made of it. */
export type MailReplyBody = {
  /** The mail's sender when left out. */
  to?: string[]
  cc?: string[]
  text: string
  html?: string
  /** Sent as a multipart form when present. */
  attachments?: File[]
}

export type MailResources = {
  get: (id: string) => Promise<AxiosItemResponse<Models.Mail>>
  patch: (id: string, body: MailPatchBody) => Promise<AxiosItemResponse<Models.Mail>>
  summary: (id: string) => Promise<AxiosItemResponse<{ summary: string }>>
  /** Written by the agent bot's persona when one is named, else the built-in one. */
  replySuggestions: (
    id: string,
    agentBotId?: string
  ) => Promise<AxiosItemResponse<{ suggestions: string[] }>>
  /** Moves the mail on the mail server too. */
  move: (id: string, folder: Models.MailMoveTarget) => Promise<AxiosDeleteResponse>
  /** Moves the mail to the trash, or deletes it for good when it is there. */
  delete: (id: string) => Promise<AxiosDeleteResponse>
  forward: (id: string, body: MailForwardBody) => Promise<AxiosDeleteResponse>
  /** Replies to the mail's sender from its account. */
  reply: (id: string, body: MailReplyBody) => Promise<AxiosDeleteResponse>
}
