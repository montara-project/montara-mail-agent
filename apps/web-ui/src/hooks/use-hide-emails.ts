import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'hideEmails'
const EMAIL = /[^\s<>@,]+@[^\s<>@,]+/g

// Storage can throw (private mode, blocked site data); the choice then lasts for this visit.
let hidden: boolean | undefined
const listeners = new Set<() => void>()

function readHidden() {
  if (hidden === undefined) {
    try {
      hidden = localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      hidden = false
    }
  }
  return hidden
}

function setHidden(value: boolean) {
  hidden = value
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Ignore: the choice still holds for this visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** `jane.doe@example.com` → `j•••@e•••.com`, for every address in the text. */
export function maskEmails(text: string) {
  return text.replace(EMAIL, (email) => {
    const [local, domain] = email.split('@')
    const dot = domain.lastIndexOf('.')
    return `${local[0]}•••@${domain[0]}•••${dot > 0 ? domain.slice(dot) : ''}`
  })
}

/**
 * Whether this browser hides email addresses (for screen sharing and demos),
 * and `mask` to pass any shown text through; it masks only while hidden.
 */
export function useHideEmails() {
  const isHidden = useSyncExternalStore(subscribe, readHidden)
  return {
    hidden: isHidden,
    setHidden,
    mask: (text: string) => (isHidden ? maskEmails(text) : text),
  }
}
