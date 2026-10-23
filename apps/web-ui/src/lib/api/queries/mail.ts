import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { MailListParams } from '../services/types/email-account'
import type { MailPatchBody } from '../services/types/mail'

import { services } from '../services'
import { ORGANIZATION_QUERY_KEY } from './organization'

export const MAIL_QUERY_KEY = 'mails'

/** One page of an account's folder; refreshed every minute to pick up synced mail. */
const list = (accountId: string | undefined, params: MailListParams) =>
  queryOptions({
    queryKey: [MAIL_QUERY_KEY, 'list', accountId, params],
    queryFn: async () => {
      const res = await services.emailAccounts.mails(accountId!, params)
      return res.data
    },
    enabled: !!accountId,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

const get = (id?: string) =>
  queryOptions({
    queryKey: [MAIL_QUERY_KEY, 'detail', id],
    queryFn: async () => {
      const res = await services.mails.get(id!)
      return res.data.data
    },
    enabled: !!id,
  })

const patch = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (body: MailPatchBody) => {
      const res = await services.mails.patch(id, body)
      return res.data.data
    },
    onSuccess: (mail) => {
      qc.setQueryData([MAIL_QUERY_KEY, 'detail', id], mail)
      qc.invalidateQueries({ queryKey: [MAIL_QUERY_KEY, 'list'] })
      // Unread counts live on the accounts and the dashboard. The account key is
      // spelled out: importing it would make the two query modules import each other.
      qc.invalidateQueries({ queryKey: ['email-accounts'] })
      qc.invalidateQueries({ queryKey: [ORGANIZATION_QUERY_KEY, 'stats'] })
    },
  })
}

/** A mail's AI summary. The server keeps it after the first call, so it is fetched once. */
const summary = (id: string) =>
  queryOptions({
    queryKey: [MAIL_QUERY_KEY, 'summary', id],
    queryFn: async () => {
      const res = await services.mails.summary(id)
      return res.data.data.summary
    },
    staleTime: Infinity,
    retry: false,
  })

/** Up to three AI reply suggestions. Each call costs a model request, so they are kept for the session. */
const replySuggestions = (id: string) =>
  queryOptions({
    queryKey: [MAIL_QUERY_KEY, 'reply-suggestions', id],
    queryFn: async () => {
      const res = await services.mails.replySuggestions(id)
      return res.data.data.suggestions
    },
    staleTime: Infinity,
    retry: false,
  })

export const mailQueries = { list, get, patch, summary, replySuggestions } as const
