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

/** What a drafted reply should say or how it should sound, and who writes it. */
export type MailDraftReplyBody = {
  instruction?: string
  agent_bot_id?: string
}

/** The tones a translated reply can take. */
export type ReplyTone = 'casual' | 'professional' | 'business'

/**
 * A skill run: the persona, a reply skill's instruction, the draft a draft
 * skill rewrites, the language a translation goes into (a BCP 47 tag) and the
 * tone of a translated reply.
 */
export type MailRunSkillBody = MailDraftReplyBody & {
  draft?: string
  language?: string
  tone?: ReplyTone
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
  /** A whole reply written by the AI; nothing is sent. */
  draftReply: (id: string, body: MailDraftReplyBody) => Promise<AxiosItemResponse<{ text: string }>>
  /** Runs a skill on the mail; nothing is sent. */
  runSkill: (
    id: string,
    key: string,
    body: MailRunSkillBody
  ) => Promise<AxiosItemResponse<Models.SkillRunResult>>
  /** Moves the mail on the mail server too. */
  move: (id: string, folder: Models.MailMoveTarget) => Promise<AxiosDeleteResponse>
  /** Moves the mail to the trash, or deletes it for good when it is there. */
  delete: (id: string) => Promise<AxiosDeleteResponse>
  forward: (id: string, body: MailForwardBody) => Promise<AxiosDeleteResponse>
  /** Replies to the mail's sender from its account. */
  reply: (id: string, body: MailReplyBody) => Promise<AxiosDeleteResponse>
}
