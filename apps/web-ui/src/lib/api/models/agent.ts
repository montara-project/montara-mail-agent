import type { ISO8601DateString } from '@/types/time'

/** One copilot conversation, bound to an organization and optionally a mailbox. */
export interface AgentConversation {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  organization_id: string
  user_id: string
  email_account_id?: string | null
  title: string
}

/** Roles of a conversation row, mirroring the server's (apps/server models/agent.go). */
export type AgentRole = 'user' | 'assistant' | 'tool'

/** One row of a conversation: a prompt, a model turn, or a tool result. */
export interface AgentMessage {
  id: string
  created_at: ISO8601DateString
  conversation_id: string
  role: AgentRole
  content: string
  tool_name?: string
  tool_payload?: unknown
  tokens_in: number
  tokens_out: number
}

/** Kinds of proposed outbound mail the agent waits for approval on. */
export type AgentActionKind = 'send_reply' | 'send_email' | 'forward'

/** Statuses of a proposal: pending until the user decides it. */
export type AgentActionStatus = 'pending' | 'approved' | 'denied' | 'done' | 'failed'

/** The proposed mail's content, as the tools wrote it into the payload. */
export interface AgentActionPayload {
  mail_id?: string
  to?: string[]
  cc?: string[] | null
  subject?: string
  text?: string
  note?: string
}

export interface AgentAction {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  conversation_id: string
  organization_id: string
  user_id: string
  kind: AgentActionKind
  payload: AgentActionPayload
  status: AgentActionStatus
  error?: string
}

/** Statuses of the automation's queued drafts. */
export type AgentDraftStatus = 'pending' | 'discarded' | 'sent'

/** A reply the background automation drafted, waiting for review. */
export interface AgentDraft {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  organization_id: string
  email_account_id: string
  mail_id?: string | null
  /** The agent bot that drafted it; absent for the built-in persona. */
  agent_bot_id?: string | null
  to: string[]
  cc?: string[]
  subject: string
  text: string
  html?: string
  status: AgentDraftStatus
  decided_by?: string | null
}
