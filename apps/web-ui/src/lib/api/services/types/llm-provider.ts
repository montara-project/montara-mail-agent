import type { AxiosResponse } from 'axios'

import type { ApiListResponse, AxiosDeleteResponse, AxiosItemResponse, Metadata } from '@/types/api'

import type { Models } from '../../models'

/** Where a provider applies: an organization's id, or null for global. */
export type LLMProviderScope = string | null

export type LLMProviderBody = {
  name: string
  kind: Models.LLMProviderKind
  base_url: string
  model: string
  /** Empty keeps the saved key while the kind and base URL stay the same. */
  api_key: string
}

/** A provider, saved or not, whose models to list. */
export type LLMModelsBody = Omit<LLMProviderBody, 'model' | 'name'>

export type LLMProviderListResponse = ApiListResponse<
  Models.LLMProviderListed,
  Metadata & {
    /** Only a super user may change the global provider. */
    super_user: boolean
    /** Whether the server's own model covers an organization with no provider. */
    fallback: boolean
    /** Whether the server may reach localhost and LAN addresses (ALLOW_PRIVATE_HOSTS). */
    private_hosts: boolean
  }
>

export type LLMProviderResources = {
  list: () => Promise<AxiosResponse<LLMProviderListResponse>>
  save: (
    scope: LLMProviderScope,
    body: LLMProviderBody
  ) => Promise<AxiosItemResponse<Models.LLMProvider>>
  delete: (scope: LLMProviderScope) => Promise<AxiosDeleteResponse>
  models: (scope: LLMProviderScope, body: LLMModelsBody) => Promise<AxiosItemResponse<string[]>>
  setScope: (id: string, scope: LLMProviderScope) => Promise<AxiosItemResponse<Models.LLMProvider>>
}
