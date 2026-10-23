import type { AxiosResponse } from 'axios'

import type { ApiItemResponse, AxiosDeleteResponse, AxiosItemResponse, Metadata } from '@/types/api'

import type { Models } from '../../models'

export type LLMProviderBody = {
  kind: Models.LLMProviderKind
  base_url: string
  model: string
  /** Empty keeps the saved key while the kind and base URL stay the same. */
  api_key: string
}

/** A provider, saved or not, whose models to list. */
export type LLMModelsBody = Omit<LLMProviderBody, 'model'>

/** `data` is null while the organization has no provider of its own. */
export type LLMProviderResponse = ApiItemResponse<Models.LLMProvider | null> & {
  metadata: Metadata & {
    fallback: boolean
    /** Whether the server may reach localhost and LAN addresses (ALLOW_PRIVATE_HOSTS). */
    private_hosts: boolean
  }
}

export type LLMProviderResources = {
  get: (organizationId: string) => Promise<AxiosResponse<LLMProviderResponse>>
  save: (
    organizationId: string,
    body: LLMProviderBody
  ) => Promise<AxiosItemResponse<Models.LLMProvider>>
  delete: (organizationId: string) => Promise<AxiosDeleteResponse>
  models: (organizationId: string, body: LLMModelsBody) => Promise<AxiosItemResponse<string[]>>
}
