import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { Models } from '../models'
import type { EmailAccountBody, MailSendBody } from '../services/types/email-account'

import { services } from '../services'
import { MAIL_QUERY_KEY } from './mail'
import { ORGANIZATION_QUERY_KEY } from './organization'

const EMAIL_ACCOUNT_QUERY_KEY = 'email-accounts'

/** Everything a connect, sync or disconnect changes: accounts, their mail, the dashboard. */
function invalidateMailboxes() {
  const qc = getQueryClient()
  qc.invalidateQueries({ queryKey: [EMAIL_ACCOUNT_QUERY_KEY] })
  qc.invalidateQueries({ queryKey: [MAIL_QUERY_KEY] })
  qc.invalidateQueries({ queryKey: [ORGANIZATION_QUERY_KEY, 'stats'] })
}

/** An organization's accounts, polled while a new one waits for its first sync. */
const list = (organizationId?: string) =>
  queryOptions({
    queryKey: [EMAIL_ACCOUNT_QUERY_KEY, 'list', organizationId],
    queryFn: async () => {
      const res = await services.emailAccounts.list(organizationId!)
      return res.data.data
    },
    enabled: !!organizationId,
    refetchInterval: (query) =>
      query.state.data?.some((account) => !account.synced_at && !account.sync_error) ? 3000 : false,
  })

const create = (organizationId: string) =>
  mutationOptions({
    mutationFn: async (body: EmailAccountBody) => {
      const res = await services.emailAccounts.create(organizationId, body)
      return res.data.data
    },
    onSuccess: invalidateMailboxes,
  })

const sync = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.emailAccounts.sync(id)
      return res.data.data
    },
    onSettled: invalidateMailboxes,
  })

/**
 * Starts connecting a mailbox over OAuth: the server returns the provider's
 * consent URL and the browser goes there. The account itself is created when
 * the provider sends the user back to the server.
 */
const oauthConnect = (organizationId: string, provider: Models.EmailProvider) =>
  mutationOptions({
    mutationFn: async () => {
      const res = await services.emailAccounts.oauthConnect(organizationId, provider)
      return res.data.data.auth_url
    },
  })

const del = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.emailAccounts.delete(id)
      return res.data
    },
    onSuccess: invalidateMailboxes,
  })

/** Sends a new mail from an account. The copy in Sent arrives with the next sync. */
const send = () =>
  mutationOptions({
    mutationFn: async ({ accountId, body }: { accountId: string; body: MailSendBody }) => {
      const res = await services.emailAccounts.send(accountId, body)
      return res.data
    },
  })

export const emailAccountQueries = { list, create, sync, oauthConnect, send, delete: del } as const
