import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { AgentSkillFormDto, BuiltinSkillDto } from '../dtos/agent-skill/schema'

import { services } from '../services'

const AGENT_SKILL_QUERY_KEY = 'agent-skills'

const list = (orgId: string) =>
  queryOptions({
    queryKey: [AGENT_SKILL_QUERY_KEY, 'list', orgId],
    queryFn: async () => {
      const res = await services.agentSkills.list(orgId)
      return res.data
    },
    enabled: !!orgId,
  })

const invalidate = () => getQueryClient().invalidateQueries({ queryKey: [AGENT_SKILL_QUERY_KEY] })

const create = (orgId: string) =>
  mutationOptions({
    mutationFn: async (reqBody: AgentSkillFormDto) => {
      const res = await services.agentSkills.store(orgId, reqBody)
      return res.data
    },
    onSuccess: invalidate,
  })

const update = (id: string) =>
  mutationOptions({
    mutationFn: async (reqBody: AgentSkillFormDto) => {
      const res = await services.agentSkills.update(id, reqBody)
      return res.data
    },
    onSuccess: invalidate,
  })

const del = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.agentSkills.delete(id)
      return res.data
    },
    onSuccess: invalidate,
  })

const setBuiltin = (orgId: string, key: string) =>
  mutationOptions({
    mutationFn: async (reqBody: BuiltinSkillDto) => {
      const res = await services.agentSkills.setBuiltin(orgId, key, reqBody)
      return res.data
    },
    onSuccess: invalidate,
  })

export const agentSkillQueries = { list, create, update, delete: del, setBuiltin } as const
