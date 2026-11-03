import { useNavigate, useSearch } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import React from 'react'

import { useDebounce } from '@/hooks/use-debounce'

// The search shortcut as this platform writes it; Ctrl K works everywhere but a Mac.
export const SEARCH_KEYS =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

/** The topbar's mail search box, beside the account filter on the mail page. */
export default function MailSearchBar() {
  const navigate = useNavigate()
  const { q } = useSearch({ strict: false })
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [search, setSearch] = React.useState(q ?? '')
  // A term cleared or changed elsewhere (a folder link, the back button) shows in the box.
  const [shownQ, setShownQ] = React.useState(q)
  if (q !== shownQ) {
    setShownQ(q)
    setSearch(q ?? '')
  }
  const debounced = useDebounce(search.trim(), 300)

  // ⌘K / Ctrl+K jumps to the search box.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // The typed term reaches the URL once typing pauses, and starts again from
  // page 1. Only a new term triggers it, so a term cleared elsewhere stays cleared.
  const pushSearch = React.useEffectEvent((term: string) => {
    if (term === (q ?? '')) return
    navigate({
      to: '/mail',
      search: (prev) => ({ ...prev, q: term || undefined, page: undefined }),
    })
  })
  React.useEffect(() => pushSearch(debounced), [debounced])

  return (
    <label className="border-border/60 bg-muted/60 focus-within:border-ring/60 focus-within:ring-ring/30 hidden h-[30px] w-64 min-w-0 items-center rounded-control border gap-1.5 px-2.5 lg:flex">
      <Search className="text-ink-3 size-3 shrink-0" aria-hidden />
      <input
        ref={inputRef}
        aria-label="Search mail"
        placeholder="Search mail"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="placeholder:text-ink-3 min-w-0 flex-1 bg-transparent text-[11.5px] outline-none"
      />
      <kbd className="text-ink-3 bg-secondary rounded-chip px-1 py-px font-mono text-[10.5px] font-semibold pointer-coarse:hidden">
        {SEARCH_KEYS}
      </kbd>
    </label>
  )
}
