import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { Models } from '../models'
import type { MailListParams } from '../services/types/email-account'
import type {
  MailBulkBody,
  MailDraftReplyBody,
  MailForwardBody,
  MailRunSkillBody,
  MailPatchBody,
  MailReplyBody,
} from '../services/types/mail'

import { services } from '../services'
import { ORGANIZATION_QUERY_KEY } from './organization'

export const MAIL_QUERY_KEY = 'mails'

/** Whose mail a list holds: one account's, or every account's of an organization (the global inbox). */
export type MailScope = { accountId: string } | { organizationId: string }

/** One page of a scope's folder; refreshed every minute to pick up synced mail. */
const list = (scope: MailScope | undefined, params: MailListParams) =>
  queryOptions({
    queryKey: [MAIL_QUERY_KEY, 'list', scope, params],
    queryFn: async () => {
      const res =
        'accountId' in scope!
          ? await services.emailAccounts.mails(scope.accountId, params)
          : await services.organizations.mails(scope!.organizationId, params)
      return res.data
    },
    enabled: !!scope,
    // The last page stays while the next loads, but never under another
    // account or organization: it would show their mail as this one's.
    placeholderData: (previous, previousQuery) =>
      JSON.stringify(previousQuery?.queryKey[2]) === JSON.stringify(scope) ? previous : undefined,
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

/** One action on the list's selection; every mailbox view refreshes after. */
const bulk = () =>
  mutationOptions({
    mutationFn: async (body: MailBulkBody) => {
      const res = await services.mails.bulk(body)
      return res.data
    },
    onSettled: () => {
      invalidateMailboxes()
      // A moved mail gets a new id, even when another account's part failed, so
      // an open reader learns its mail is gone and offers the way back.
      void getQueryClient().invalidateQueries({ queryKey: [MAIL_QUERY_KEY, 'detail'] })
    },
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

/**
 * Runs a skill on a mail. An organize run relabels it and a summary run may
 * keep its summary, so the mail and the lists refetch afterwards.
 */
const runSkill = (id: string) =>
  mutationOptions({
    mutationFn: async ({ key, ...body }: MailRunSkillBody & { key: string }) => {
      const res = await services.mails.runSkill(id, key, body)
      return res.data.data
    },
    onSuccess: (result) => {
      if (result.kind === 'organize' || result.kind === 'summary') {
        void getQueryClient().invalidateQueries({ queryKey: [MAIL_QUERY_KEY] })
      }
    },
  })

export const mailQueries = {
  list,
  get,
  patch,
  summary,
  replySuggestions,
  draftReply,
  runSkill,
  move,
  delete: remove,
  bulk,
  forward,
  reply,
} as const
