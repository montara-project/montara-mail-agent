import type { ISO8601DateString } from '@/types/time'

/**
 * A key MCP clients sign in to /mcp with. Mirrors the server's apiKeyView
 * (apps/server internal/handlers/api_key.go): never the key itself.
 */
export interface APIKey {
  id: string
  name: string
  /** Its first and last characters, e.g. `mm_ab12…yz89`. */
  hint: string
  /** The one organization the key reaches; null for a global key, which reaches all of yours. */
  organization_id: string | null
  /** Empty when that organization was since deleted for good. */
  organization_name: string | null
  created_at: ISO8601DateString
  expires_at: ISO8601DateString | null
  last_used_at: ISO8601DateString | null
}

/** A key just created: the only answer that carries its value. */
export interface CreatedAPIKey {
  api_key: APIKey
  key: string
}
