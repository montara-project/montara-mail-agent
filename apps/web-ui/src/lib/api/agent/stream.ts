import type { Models } from '../models'

import {
  getStoredAccessToken,
  getStoredRefreshToken,
  setAuthTokens,
} from '../../auth/token-storage'
import { api } from '../client-fetch'
import { SERVER_URL } from '../server-url'

/**
 * The events a copilot turn streams, in the shape the server's SSE handler
 * writes (apps/server internal/mailagent/agent.go). `payload` carries the
 * bound conversation on "conversation" and a proposed action on "action".
 */
export type AgentStreamEvent = {
  type: 'conversation' | 'status' | 'tool' | 'message' | 'action' | 'error' | 'done'
  name?: string
  text?: string
  payload?: Models.AgentAction | { id: string } | unknown
}

/**
 * Trade the stored refresh token for a fresh pair, like client-fetch's
 * interceptor does for axios calls; the stream has to do it itself.
 */
async function refreshedAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return null
  try {
    const res = await api.post<{ access_token: string; refresh_token: string }>(
      '/api/v1/auth/token/refresh',
      { refresh_token: refreshToken }
    )
    setAuthTokens({ accessToken: res.data.access_token, refreshToken: res.data.refresh_token })
    return res.data.access_token
  } catch {
    return null
  }
}

/**
 * Stream one copilot turn. Server-sent events need a POST with an
 * Authorization header, so this is a fetch with a ReadableStream — the axios
 * instance has no stream support and EventSource cannot send either. An
 * expired access token is refreshed once before giving up. Throws before the
 * stream opens (validation, auth); after it opens, failures arrive as `error`
 * events.
 */
export async function streamAgentChat(
  body: { conversation_id?: string; email_account_id?: string; message: string },
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const open = async (token: string) =>
    fetch(`${SERVER_URL}/api/v1/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal,
    })

  let res = await open(getStoredAccessToken() ?? '')
  if (res.status === 401) {
    const token = await refreshedAccessToken()
    if (token) res = await open(token)
  }
  if (!res.ok || !res.body) {
    // The API's JSON envelope with the failure message, when there is one.
    let message = `The agent could not start (HTTP ${res.status})`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) message = body.message
    } catch {
      // A non-JSON failure keeps the generic message.
    }
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const emitBlock = (block: string) => {
    const lines = block.split('\n')
    let type = ''
    let data = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) type = line.slice(7).trim()
      if (line.startsWith('data: ')) data = line.slice(6)
    }
    if (type === '' || data === '') return
    try {
      onEvent(JSON.parse(data) as AgentStreamEvent)
    } catch {
      // A malformed event is skipped; the stream carries on.
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE events are separated by a blank line.
    let boundary: number
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      emitBlock(block)
    }
  }
  if (buffer.trim() !== '') emitBlock(buffer)
}
