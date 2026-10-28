import type { ISO8601DateString } from '@/types/time'

/**
 * How a server is reached: hosted is HTTP with an OAuth sign-in, http is
 * HTTP with optional headers, command is a local process over stdio.
 */
export type MCPServerKind = 'hosted' | 'http' | 'command'

/** pending until the first sync; needs_auth for a hosted server to connect. */
export type MCPServerStatus = 'pending' | 'connected' | 'needs_auth' | 'error'

/** A tool a server offered at its last sync. */
export interface MCPTool {
  name: string
  description: string
  /** The JSON Schema of the tool's arguments. */
  input_schema: {
    type?: string
    properties?: Record<string, { type?: string | string[]; description?: string }>
    required?: string[]
  }
}

export interface MCPServer {
  id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  organization_id: string
  /** A slug; it also prefixes the server's tools for the agent. */
  name: string
  kind: MCPServerKind
  url: string
  command: string
  args: string[]
  /** Header and environment names; their values never leave the server. */
  headers: { name: string }[]
  env: { name: string }[]
  tools: MCPTool[]
  status: MCPServerStatus
  status_message: string
  synced_at: ISO8601DateString | null
  is_enabled: boolean
}
