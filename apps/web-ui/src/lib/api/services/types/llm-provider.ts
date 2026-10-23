import type { AxiosResponse } from 'axios'

import type { ApiItemResponse, AxiosDeleteResponse, AxiosItemResponse, Metadata } from '@/types/api'

import type { Models } from '../../models'

export type LLMProviderBody = {
  kind: Models.LLMProviderKind
  base_url: string
  model: string
  /** Empty keeps the saved key. */
  api_key: string
}

/** `data` is null while the organization has no provider of its own. */
export type LLMProviderResponse = ApiItemResponse<Models.LLMProvider | null> & {
  metadata: Metadata & { fallback: boolean }
}

export type LLMProviderResources = {
  get: (organizationId: string) => Promise<AxiosResponse<LLMProviderResponse>>
  save: (
    organizationId: string,
    body: LLMProviderBody
  ) => Promise<AxiosItemResponse<Models.LLMProvider>>
  delete: (organizationId: string) => Promise<AxiosDeleteResponse>
}
