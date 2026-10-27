import type { AxiosDeleteResponse, AxiosItemResponse, AxiosListResponse } from '@/types/api'

import type { AgentSkillFormDto, BuiltinSkillDto } from '../../dtos/agent-skill/schema'
import type { Models } from '../../models'

export type AgentSkillResources = {
  list: (orgId: string) => Promise<AxiosListResponse<Models.AgentSkill>>
  store: (orgId: string, body: AgentSkillFormDto) => Promise<AxiosItemResponse<Models.AgentSkill>>
  update: (id: string, body: AgentSkillFormDto) => Promise<AxiosItemResponse<Models.AgentSkill>>
  delete: (id: string) => Promise<AxiosDeleteResponse>
  setBuiltin: (
    orgId: string,
    key: string,
    body: BuiltinSkillDto
  ) => Promise<AxiosItemResponse<Models.AgentSkill>>
}
