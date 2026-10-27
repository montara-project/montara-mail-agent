/**
 * A task the AI agent runs on mail, from the reader's Skills menu or as a
 * /command in the assistant. Mirrors the server's skillView (apps/server
 * internal/handlers/agent_skill.go).
 */
export interface AgentSkill {
  /** The built-in key (summarize, organize, draft_reply) or the custom skill's id. */
  key: string
  builtin: boolean
  name: string
  description: string
  /** A custom skill's instruction; empty for a built-in one. */
  instruction: string
  /** The bot that runs it; null means the one the user picked. */
  agent_bot_id: string | null
  is_enabled: boolean
  /** What it works on: the email, or the reply draft being written (it rewrites that). */
  target: 'email' | 'draft'
}

/** What running a skill on a mail made. */
export type SkillRunResult =
  | { kind: 'summary' | 'reply' | 'rewrite' | 'text'; text: string }
  | { kind: 'organize'; importance: import('./mail').MailImportance }
