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

/** The code and state an OAuth callback returns to the web app with. */
export type OAuthFinishBody = { code: string; state: string }

export type EmailAccountResources = {
  list: (organizationId: string) => Promise<AxiosListResponse<Models.EmailAccount>>
  create: (
    organizationId: string,
    body: EmailAccountBody
  ) => Promise<AxiosItemResponse<Models.EmailAccount>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
  transfer: (
    id: string,
    body: { organization_id: string }
  ) => Promise<AxiosItemResponse<Models.EmailAccount>>
  sync: (id: string) => Promise<AxiosItemResponse<Models.EmailAccount>>
  /** Sends a new mail from the account. */
  send: (id: string, body: MailSendBody) => Promise<AxiosDeleteResponse>
  /** The metadata adds the folder's unread count. */
  mails: (
    id: string,
    params: MailListParams
  ) => Promise<AxiosResponse<ApiListResponse<Models.Mail, Metadata & { unread: number }>>>
  /**
   * Asks the server for the provider's consent URL that connects a mailbox
   * over OAuth. The browser then goes to that URL; the server owns the
   * provider's OAuth client secret and receives the user back once the
   * account is connected.
   */
  /** Finishes an OAuth connection with the code and state the callback handed back. */
  oauthFinish: (
    provider: string,
    body: OAuthFinishBody
  ) => Promise<AxiosItemResponse<{ email: string; provider: string }>>
  oauthConnect: (
    organizationId: string,
    provider: Models.EmailProvider
  ) => Promise<AxiosItemResponse<{ auth_url: string }>>
}
