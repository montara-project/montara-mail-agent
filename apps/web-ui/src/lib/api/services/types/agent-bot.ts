import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { AgentBotFormDto } from '../../dtos/agent-bot/schema'
import type { Models } from '../../models'

export type AgentBotResources = {
  list: (orgId: string) => Promise<AxiosListResponse<Models.AgentBot>>
  get: (id: string) => Promise<AxiosItemResponse<Models.AgentBot>>
  store: (orgId: string, body: AgentBotFormDto) => Promise<AxiosItemResponse<Models.AgentBot>>
  update: (id: string, body: AgentBotFormDto) => Promise<AxiosItemResponse<Models.AgentBot>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
}
