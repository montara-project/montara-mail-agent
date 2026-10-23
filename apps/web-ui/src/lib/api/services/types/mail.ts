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

export type MailResources = {
  get: (id: string) => Promise<AxiosItemResponse<Models.Mail>>
  patch: (id: string, body: MailPatchBody) => Promise<AxiosItemResponse<Models.Mail>>
  summary: (id: string) => Promise<AxiosItemResponse<{ summary: string }>>
  replySuggestions: (id: string) => Promise<AxiosItemResponse<{ suggestions: string[] }>>
  /** Moves the mail on the mail server too. */
  move: (id: string, folder: Models.MailMoveTarget) => Promise<AxiosDeleteResponse>
  /** Moves the mail to the trash, or deletes it for good when it is there. */
  delete: (id: string) => Promise<AxiosDeleteResponse>
  forward: (id: string, body: MailForwardBody) => Promise<AxiosDeleteResponse>
}
