import { mutationOptions, queryOptions } from '@tanstack/react-query'

import { getQueryClient } from '@/lib/providers/react-query'

import type { OAuthFinishBody } from '../services/types/email-account'
import type { MCPServerBody } from '../services/types/mcp-server'

import { services } from '../services'

export const MCP_SERVER_QUERY_KEY = 'mcp-servers'

const invalidate = () => getQueryClient().invalidateQueries({ queryKey: [MCP_SERVER_QUERY_KEY] })

/** An organization's servers, and whether the user may add a command one. */
const list = (orgId: string) =>
  queryOptions({
    queryKey: [MCP_SERVER_QUERY_KEY, 'list', orgId],
    queryFn: async () => {
      const res = await services.mcpServers.list(orgId)
      return res.data
    },
    enabled: !!orgId,
  })

const create = (orgId: string) =>
  mutationOptions({
    mutationFn: async (body: MCPServerBody) => {
      const res = await services.mcpServers.store(orgId, body)
      return res.data.data
    },
    onSuccess: invalidate,
  })

const update = (id: string) =>
  mutationOptions({
    mutationFn: async (body: MCPServerBody) => {
      const res = await services.mcpServers.update(id, body)
      return res.data.data
    },
    onSuccess: invalidate,
  })

const del = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.mcpServers.delete(id)
      return res.data
    },
    onSuccess: invalidate,
  })

const testDraft = (orgId: string) =>
  mutationOptions({
    mutationFn: async (body: MCPServerBody & { id?: string }) => {
      const res = await services.mcpServers.testDraft(orgId, body)
      return res.data.data
    },
  })

/** Test or sync a saved server; either records its status, so the list refreshes. */
const contact = (action: 'test' | 'sync') =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.mcpServers[action](id)
      return res.data.data
    },
    onSettled: invalidate,
  })

const oauthStart = () =>
  mutationOptions({
    mutationFn: async (id: string) => {
      const res = await services.mcpServers.oauthStart(id)
      return res.data.data
    },
  })

/** Finishes a hosted server's sign-in the provider sent the browser back from. */
const oauthFinish = () =>
  mutationOptions({
    mutationFn: async (body: OAuthFinishBody) => {
      const res = await services.mcpServers.oauthFinish(body)
      return res.data.data
    },
    onSettled: invalidate,
  })

export const mcpServerQueries = {
  list,
  create,
  update,
  delete: del,
  testDraft,
  test: () => contact('test'),
  sync: () => contact('sync'),
  oauthStart,
  oauthFinish,
} as const
