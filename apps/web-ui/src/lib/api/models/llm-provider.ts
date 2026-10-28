import type { ISO8601DateString } from '@/types/time'

/**
 * The wire format spoken, so any compatible server works. self_hosted is the
 * OpenAI format on a server the user runs, where the API key is optional.
 */
export type LLMProviderKind = 'openai' | 'anthropic' | 'self_hosted'

export interface LLMProvider {
  id: string
  /** null for the global provider, which every organization without its own uses. */
  organization_id: string | null
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  name: string
  kind: LLMProviderKind
  /** Empty means the vendor's own API. */
  base_url: string
  model: string
  has_api_key: boolean
}

/** A listed provider, with its organization's name ('' for the global one). */
export interface LLMProviderListed extends LLMProvider {
  organization_name: string
}
