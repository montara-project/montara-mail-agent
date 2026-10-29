import type { AxiosResponse } from 'axios'

import type { ApiListResponse, AxiosDeleteResponse, AxiosItemResponse, Metadata } from '@/types/api'

import type { Models } from '../../models'
import type { OAuthFinishBody } from './email-account'

/** A header or environment variable; on an edit a blank value keeps the saved one. */
export type MCPPair = { name: string; value: string }

export type MCPServerBody = {
  name: string
  kind: Models.MCPServerKind
  url?: string
  headers?: MCPPair[]
  command?: string
  args?: string[]
  env?: MCPPair[]
  is_enabled?: boolean
}

export type MCPServerListResponse = ApiListResponse<
  Models.MCPServer,
  Metadata & {
    /** Only a super user may add or change a command server. */
    command_allowed: boolean
  }
>

/** How a test or sync went: the tools found, and the server as it now stands. */
export type MCPContactResult = { tool_count: number; tools?: string[]; server?: Models.MCPServer }

export type MCPServerResources = {
  list: (orgId: string) => Promise<AxiosResponse<MCPServerListResponse>>
  store: (orgId: string, body: MCPServerBody) => Promise<AxiosItemResponse<Models.MCPServer>>
  update: (id: string, body: MCPServerBody) => Promise<AxiosItemResponse<Models.MCPServer>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
  /** Tests unsaved form values; id names the server being edited. */
  testDraft: (
    orgId: string,
    body: MCPServerBody & { id?: string }
  ) => Promise<AxiosItemResponse<MCPContactResult>>
  test: (id: string) => Promise<AxiosItemResponse<MCPContactResult>>
  sync: (id: string) => Promise<AxiosItemResponse<MCPContactResult>>
  /** A hosted server's sign-in page, where the browser goes next. */
  oauthStart: (id: string) => Promise<AxiosItemResponse<{ auth_url: string }>>
  /** Finishes a hosted server's sign-in with the code and state the callback handed back. */
  oauthFinish: (body: OAuthFinishBody) => Promise<AxiosItemResponse<{ name: string }>>
}
