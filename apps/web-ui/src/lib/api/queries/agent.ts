import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { AgentConversationBody } from '../services/types/agent'

import { services } from '../services'

const AGENT_QUERY_KEY = 'agent'

const conversations = (organizationId?: string) =>
  queryOptions({
    queryKey: [AGENT_QUERY_KEY, 'conversations', organizationId],
    queryFn: async () => {
      const res = await services.agent.conversations(organizationId!)
      return res.data
    },
    enabled: !!organizationId,
  })

/** A conversation with its messages and actions, one cache entry per panel. */
const conversation = (id?: string) =>
  queryOptions({
    queryKey: [AGENT_QUERY_KEY, 'conversation', id],
    queryFn: async () => {
      const res = await services.agent.conversation(id!)
      return res.data
    },
    enabled: !!id,
  })

const drafts = (organizationId?: string, status?: string) =>
  queryOptions({
    queryKey: [AGENT_QUERY_KEY, 'drafts', organizationId, status],
    queryFn: async () => {
      const res = await services.agent.drafts(organizationId!, status)
      return res.data
    },
    enabled: !!organizationId,
  })

/** Every write invalidates the whole agent slice: turns and decisions redraw the panel. */
const invalidateAgent = () => {
  const qc = getQueryClient()
  return () => qc.invalidateQueries({ queryKey: [AGENT_QUERY_KEY] })
}

const createConversation = () =>
  mutationOptions({
    mutationFn: async (body: AgentConversationBody) => {
      const res = await services.agent.createConversation(body)
      return res.data.data
    },
    onSuccess: invalidateAgent(),
  })

const deleteConversation = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.agent.deleteConversation(id)
      return res.data
    },
    onSuccess: invalidateAgent(),
  })

const approveAction = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.agent.approveAction(id)
      return res.data.data
    },
    onSuccess: invalidateAgent(),
  })

const denyAction = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.agent.denyAction(id)
      return res.data.data
    },
    onSuccess: invalidateAgent(),
  })

const approveDraft = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.agent.approveDraft(id)
      return res.data.data
    },
    onSuccess: invalidateAgent(),
  })

const discardDraft = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.agent.discardDraft(id)
      return res.data.data
    },
    onSuccess: invalidateAgent(),
  })

export const agentQueries = {
  conversations,
  conversation,
  drafts,
  createConversation,
  deleteConversation,
  approveAction,
  denyAction,
  approveDraft,
  discardDraft,
} as const
