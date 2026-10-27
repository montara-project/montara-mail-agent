import { keepPreviousData, mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { Models } from '../models'
import type { MailListParams } from '../services/types/email-account'
import type {
  MailDraftReplyBody,
  MailForwardBody,
  MailPatchBody,
  MailReplyBody,
} from '../services/types/mail'

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
      invalidateMailboxes()
    },
  })
}

/** A mail's AI summary. The server keeps it after the first call, so it is fetched once. */
const summary = (id: string) =>
  queryOptions({
    queryKey: [MAIL_QUERY_KEY, 'summary', id],
    queryFn: async () => {
      const res = await services.mails.summary(id)
      const text = res.data.data.summary
      // The mail now carries it too, as it will when it is next loaded.
      getQueryClient().setQueryData<Models.Mail>([MAIL_QUERY_KEY, 'detail', id], (mail) =>
        mail ? { ...mail, summary: text } : mail
      )
      return text
    },
    staleTime: Infinity,
    retry: false,
  })

/** Up to three AI reply suggestions. Each call costs a model request, so they are kept for the session. */
const replySuggestions = (id: string, agentBotId = '') =>
  queryOptions({
    queryKey: [MAIL_QUERY_KEY, 'reply-suggestions', id, agentBotId],
    queryFn: async () => {
      const res = await services.mails.replySuggestions(id, agentBotId || undefined)
      return res.data.data.suggestions
    },
    staleTime: Infinity,
    retry: false,
  })

/**
 * After a mail changes or leaves its folder: lists, unread counts and the
 * dashboard. The account key is spelled out: importing it would make the two
 * query modules import each other.
 */
function invalidateMailboxes() {
  const qc = getQueryClient()
  qc.invalidateQueries({ queryKey: [MAIL_QUERY_KEY, 'list'] })
  qc.invalidateQueries({ queryKey: ['email-accounts'] })
  qc.invalidateQueries({ queryKey: [ORGANIZATION_QUERY_KEY, 'stats'] })
}

const move = (id: string) =>
  mutationOptions({
    mutationFn: async (folder: Models.MailMoveTarget) => {
      const res = await services.mails.move(id, folder)
      return res.data
    },
    onSuccess: invalidateMailboxes,
  })

const remove = (id: string) =>
  mutationOptions({
    mutationFn: async () => {
      const res = await services.mails.delete(id)
      return res.data
    },
    onSuccess: invalidateMailboxes,
  })

const forward = (id: string) =>
  mutationOptions({
    mutationFn: async (body: MailForwardBody) => {
      const res = await services.mails.forward(id, body)
      return res.data
    },
  })

const reply = (id: string) =>
  mutationOptions({
    mutationFn: async (body: MailReplyBody) => {
      const res = await services.mails.reply(id, body)
      return res.data
    },
  })

/** A whole AI-written reply for the editor; a model call per request, so it is never cached. */
const draftReply = (id: string) =>
  mutationOptions({
    mutationFn: async (body: MailDraftReplyBody) => {
      const res = await services.mails.draftReply(id, body)
      return res.data.data.text
    },
  })

export const mailQueries = {
  list,
  get,
  patch,
  summary,
  replySuggestions,
  draftReply,
  move,
  delete: remove,
  forward,
  reply,
} as const
