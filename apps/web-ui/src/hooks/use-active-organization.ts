import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

import { queries } from '@/lib/api/queries'

const ACTIVE_ORGANIZATION_KEY = 'activeOrganizationId'

// Storage can throw (private mode, blocked site data); the choice then lasts for this visit.
function readActiveId() {
  try {
    return localStorage.getItem(ACTIVE_ORGANIZATION_KEY)
  } catch {
    return null
  }
}

let activeId = readActiveId()
const listeners = new Set<() => void>()

/** Makes an organization the active one on every page. */
export function setActiveOrganizationId(id: string) {
  activeId = id
  try {
    localStorage.setItem(ACTIVE_ORGANIZATION_KEY, id)
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
 * The signed-in user's organizations and the active one: the last picked,
 * else the first.
 */
export function useActiveOrganization() {
  const id = useSyncExternalStore(subscribe, () => activeId)
  // ponytail: first 100 only (the API's limit cap); add search once accounts outgrow it.
  const { data, isPending, isError } = useQuery(
    queries.organizations.list({ offset: 0, limit: 100 })
  )
  const organizations = data?.data ?? []
  const organization = organizations.find((org) => org.id === id) ?? organizations[0]

  return { organization, organizations, isPending, isError }
}
