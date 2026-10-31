import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { queries } from '@/lib/api/queries'
import { getQueryClient } from '@/lib/providers/react-query'

// The pick is stored per signed-in user. The old key was shared by every
// account on the browser; it is cleared at sign-out and never read again.
const LEGACY_KEY = 'activeOrganizationId'
const storageKey = (userId: string) => `activeOrganizationId:${userId}`

// Storage can throw (private mode, blocked site data); the choice then lasts for this visit.
const picks = new Map<string, string | null>()
const listeners = new Set<() => void>()

function signedInUserId(): string {
  try {
    // The profile cache holds GET /me's body: { user: { id } } (queries.auth.profile()).
    return getQueryClient().getQueryData<{ user?: { id?: string } }>(['profile'])?.user?.id ?? ''
  } catch {
    return ''
  }
}

function readPick(userId: string) {
  if (!picks.has(userId)) {
    try {
      picks.set(userId, localStorage.getItem(storageKey(userId)))
    } catch {
      picks.set(userId, null)
    }
  }
  return picks.get(userId) ?? null
}

/** Makes an organization the active one on every page. */
export function setActiveOrganizationId(id: string) {
  const userId = signedInUserId()
  if (!userId) return
  picks.set(userId, id)
  try {
    localStorage.setItem(storageKey(userId), id)
  } catch {
    // Ignore: the selection still holds for this visit.
  }
  listeners.forEach((listener) => listener())
}

/** Forgets the shared pre-per-user key; the per-user ones are inert across accounts. */
export function clearActiveOrganization() {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // Ignore.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * The signed-in user's organizations and the active one: the last picked for
 * this account, else the first of their own. The pick is stored per user, so
 * the next account on this browser starts from its own.
 */
export function useActiveOrganization() {
  const { data: me } = useQuery(queries.auth.profile())
  const userId = me?.user?.id ?? ''
  const id = useSyncExternalStore(subscribe, () => (userId ? readPick(userId) : null))

  // ponytail: first 100 only (the API's limit cap); add search once accounts outgrow it.
  // member=1 keeps the switcher on the user's own organizations even for a
  // super user, whose management pages take the unscoped list.
  const { data, isPending, isError } = useQuery(
    queries.organizations.list({ offset: 0, limit: 100, member: 'true' })
  )
  const organizations = data?.data ?? []
  const organization = organizations.find((org) => org.id === id) ?? organizations[0]

  return { organization, organizations, isPending, isError }
}
