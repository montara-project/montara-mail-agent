import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { queries } from '@/lib/api/queries'

import { useActiveOrganization } from './use-active-organization'

const storageKey = (orgId: string) => `activeAgentBotId:${orgId}`

// Storage can throw (private mode, blocked site data); the choice then lasts for this visit.
// null means never picked, '' the built-in assistant.
const picks = new Map<string, string | null>()
const listeners = new Set<() => void>()

function readPick(orgId: string) {
  if (!picks.has(orgId)) {
    try {
      picks.set(orgId, localStorage.getItem(storageKey(orgId)))
    } catch {
      picks.set(orgId, null)
    }
  }
  return picks.get(orgId) ?? null
}

/** Picks the bot the assistant speaks as in one organization; '' is the built-in one. */
export function setActiveAgentBotId(orgId: string, id: string) {
  picks.set(orgId, id)
  try {
    localStorage.setItem(storageKey(orgId), id)
  } catch {
    // Ignore: the selection still holds for this visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The active organization's agent bots and the one the chat and reply
 * suggestions speak as: the last picked, else the default bot, else the
 * built-in assistant (''). The pick is shared by every surface that uses it.
 */
export function useActiveAgentBot() {
  const { organization } = useActiveOrganization()
  const orgId = organization?.id ?? ''
  const pick = useSyncExternalStore(subscribe, () => (orgId ? readPick(orgId) : null))
  const { data } = useQuery(queries.agentBots.list(orgId))
  const bots = data?.data ?? []

  const picked = pick ? bots.find((bot) => bot.id === pick) : undefined
  // A deleted pick falls back like no pick at all.
  const activeBot = pick === '' ? undefined : (picked ?? bots.find((bot) => bot.is_default))

  return {
    bots,
    /** The choices for a PromptBar picker: the built-in assistant ('') first. */
    personas: [
      { key: '', name: 'Built-in' },
      ...bots.map((bot) => ({
        key: bot.id,
        name: bot.name,
        tag: bot.is_default ? 'Default' : undefined,
      })),
    ],
    activeBot,
    activeBotId: activeBot?.id ?? '',
    setActiveBotId: (id: string) => orgId && setActiveAgentBotId(orgId, id),
  }
}
