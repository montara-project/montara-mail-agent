import type { AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { Models } from '../../models'

export type AgentConversationBody = {
  email_account_id: string
}

export type AgentConversationDetail = {
  conversation: Models.AgentConversation
  messages: Models.AgentMessage[]
  actions: Models.AgentAction[]
}

export type AgentResources = {
  conversations: (organizationId: string) => Promise<AxiosListResponse<Models.AgentConversation>>
  createConversation: (
    body: AgentConversationBody
  ) => Promise<AxiosItemResponse<Models.AgentConversation>>
  /** The conversation with its messages and actions, one answer redraws the panel. */
  conversation: (id: string) => Promise<AxiosItemResponse<AgentConversationDetail>>
  deleteConversation: (id: string) => Promise<{ data: { message?: string } }>
  drafts: (organizationId: string, status?: string) => Promise<AxiosListResponse<Models.AgentDraft>>
  approveAction: (id: string) => Promise<AxiosItemResponse<Models.AgentAction>>
  denyAction: (id: string) => Promise<AxiosItemResponse<Models.AgentAction>>
  approveDraft: (id: string) => Promise<AxiosItemResponse<Models.AgentDraft>>
  discardDraft: (id: string) => Promise<AxiosItemResponse<Models.AgentDraft>>
}
