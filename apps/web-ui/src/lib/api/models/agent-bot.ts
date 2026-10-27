import type { ISO8601DateString } from '@/types/time'

/**
 * One user-defined persona for the AI agent: who it is (soul), what it should
 * remember (memory), how it writes (style) and what it must or must not do
 * (instruction). Mirrors the server's AgentBot (apps/server internal/models/agent_bot.go).
 */
export interface AgentBot {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  organization_id: string
  name: string
  description: string
  soul: string
  memory: string
  style: string
  instruction: string
  /** At most one live bot per organization is the auto-drafter's default. */
  is_default: boolean
  deleted_at?: ISO8601DateString | null
  /** The persona composed from the fields above; the runtime prompt adds the date and mailbox. */
  system_prompt: string
}
