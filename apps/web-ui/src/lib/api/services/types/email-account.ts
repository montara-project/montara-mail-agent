import type { AxiosResponse } from 'axios'

import type {
  ApiListResponse,
  AxiosDeleteResponse,
  AxiosItemResponse,
  AxiosListResponse,
  Metadata,
} from '@/types/api'

import type { Models } from '../../models'

export type EmailAccountBody = {
  provider: Models.EmailProvider
  email: string
  password: string
  label?: string
  username?: string
  /** Custom IMAP only; the known providers' servers are built in. */
  imap_host?: string
  imap_port?: number
  /** Custom IMAP only; defaults to the IMAP host with "smtp." in front, on 465. */
  smtp_host?: string
  smtp_port?: number
}

export type MailListParams = {
  offset?: number
  limit?: number
  search?: string
  folder?: Models.MailFolder
  importance?: Models.MailImportance
}

/** A new mail: recipients, subject, and the body as Markdown and as HTML. */
export type MailSendBody = {
  to: string[]
  cc?: string[]
  subject: string
  text: string
  html?: string
  /** Sent as a multipart form when present. */
  attachments?: File[]
}

export type EmailAccountResources = {
  list: (organizationId: string) => Promise<AxiosListResponse<Models.EmailAccount>>
  create: (
    organizationId: string,
    body: EmailAccountBody
  ) => Promise<AxiosItemResponse<Models.EmailAccount>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
  sync: (id: string) => Promise<AxiosItemResponse<Models.EmailAccount>>
  /** Sends a new mail from the account. */
  send: (id: string, body: MailSendBody) => Promise<AxiosDeleteResponse>
  /** The metadata adds the folder's unread count. */
  mails: (
    id: string,
    params: MailListParams
  ) => Promise<AxiosResponse<ApiListResponse<Models.Mail, Metadata & { unread: number }>>>
}
