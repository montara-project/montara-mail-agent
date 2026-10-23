import type { ISO8601DateString } from '@/types/time'

/** The wire format spoken, so any compatible server works. */
export type LLMProviderKind = 'openai' | 'anthropic'

export interface LLMProvider {
  organization_id: string
  created_at: ISO8601DateString
  updated_at: ISO8601DateString
  kind: LLMProviderKind
  /** Empty means the vendor's own API. */
  base_url: string
  model: string
  has_api_key: boolean
}
