import { ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'

import { cn } from '@/lib/utils'

/** How many page numbers show at once. */
const PAGE_WINDOW = 5

/**
 * One page of a list the browser already holds. The page clamps to the last
 * one when rows leave (an unblock, a sign-out), so it never shows empty.
 */
export function usePaged<T>(items: T[], size: number) {
  const [page, setPage] = React.useState(0)
  const pageCount = Math.ceil(items.length / size)
  const shown = Math.max(0, Math.min(page, pageCount - 1))
  const first = shown * size
  return { page: shown, setPage, pageCount, first, pageItems: items.slice(first, first + size) }
}

/** "Showing 11–20 of 34 events". */
export function PageRange({
  first,
  count,
  total,
  noun,
}: {
  first: number
  count: number
  total: number
  noun?: string
}) {
  return (
    <p className="text-ink-3 flex items-center gap-[0.3125rem] text-[0.71875rem] leading-[0.875rem]">
      Showing
      <span className="text-foreground font-bold tabular-nums">
        {first + 1}–{first + count}
      </span>
      of {total}
      {noun && ` ${noun}`}
    </p>
  )
}

/** Previous, up to five page numbers around the current one, next. Pages count from 0. */
export function PageNav({
  page,
  pageCount,
  onChange,
  label,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
  /** Names the list for screen readers, e.g. "Activity log pages". */
  label: string
}) {
  const start = Math.max(0, Math.min(page - 2, pageCount - PAGE_WINDOW))
  const pages = Array.from({ length: Math.min(PAGE_WINDOW, pageCount) }, (_, i) => start + i)
  const cell =
    'grid size-6 shrink-0 place-items-center rounded-[0.4375rem] border border-transparent text-[0.75rem] outline-none transition-colors duration-150 focus-visible:ring-[0.1875rem] focus-visible:ring-ring/50 pointer-coarse:size-11 motion-reduce:transition-none'
  const arrow = cn(
    cell,
    'text-muted-foreground hover:bg-accent disabled:text-ink-faint disabled:hover:bg-transparent'
  )

  return (
    <nav aria-label={label} className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
        className={arrow}
      >
        <ChevronLeft className="size-3" aria-hidden />
      </button>
      {pages.map((item) => (
        <button
          key={item}
          type="button"
          aria-label={`Page ${item + 1}`}
          aria-current={item === page ? 'page' : undefined}
          onClick={() => onChange(item)}
          className={cn(
            cell,
            item === page
              ? 'border-accent-ink/40 bg-accent-ink/6 text-accent-soft font-bold'
              : 'text-ink-3 hover:bg-accent font-medium'
          )}
        >
          {item + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount - 1}
        onClick={() => onChange(page + 1)}
        className={arrow}
      >
        <ChevronRight className="size-3" aria-hidden />
      </button>
    </nav>
  )
}
