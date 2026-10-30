import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { AgentBotFormDto } from '../dtos/agent-bot/schema'

import { services } from '../services'

const AGENT_BOT_QUERY_KEY = 'agent-bots'

const LIST_AGENT_BOT_QUERY_KEY = (orgId: string) => {
  return [AGENT_BOT_QUERY_KEY, 'list', orgId]
}

const GET_AGENT_BOT_QUERY_KEY = (id: string) => {
  return [AGENT_BOT_QUERY_KEY, 'detail', id]
}

const list = (orgId: string) =>
  queryOptions({
    queryKey: LIST_AGENT_BOT_QUERY_KEY(orgId),
    queryFn: async () => {
      const res = await services.agentBots.list(orgId)
      return res.data
    },
    enabled: !!orgId,
  })

const get = (id: string) =>
  queryOptions({
    queryKey: GET_AGENT_BOT_QUERY_KEY(id),
    queryFn: async () => {
      const res = await services.agentBots.get(id)
      return res.data
    },
  })

const create = (orgId: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: AgentBotFormDto) => {
      const res = await services.agentBots.store(orgId, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [AGENT_BOT_QUERY_KEY] })
    },
  })
}

const update = (id: string) => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (reqBody: AgentBotFormDto) => {
      const res = await services.agentBots.update(id, reqBody)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [AGENT_BOT_QUERY_KEY] })
    },
  })
}

const del = () => {
  const qc = getQueryClient()

  return mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.agentBots.delete(id)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [AGENT_BOT_QUERY_KEY] })
    },
  })
}

export const agentBotQueries = { list, get, create, update, delete: del } as const
