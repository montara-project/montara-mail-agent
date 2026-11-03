import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Search } from 'lucide-react'
import React from 'react'

import { SettingsPage } from '@/components/block/common/settings-card'
import { SEARCH_KEYS } from '@/components/layout/mail/mail-search'
import { Badge } from '@/components/ui/badge'
import {
  DANGER_GROUP,
  PLATFORM_GROUP,
  SETTINGS_GROUPS,
  type SettingsGroup,
  type SettingsItem,
} from '@/data/settings-menu'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const ROW =
  'flex items-center gap-2.5 rounded-control px-[0.6875rem] py-[0.5625rem] outline-none transition-colors duration-150 focus-visible:ring-[0.1875rem] focus-visible:ring-ring/50 motion-reduce:transition-none'

/** Icon, title and meta: what a row shows whether or not it opens a page. */
function RowContent({ item, danger }: { item: SettingsItem; danger?: boolean }) {
  return (
    <>
      <span
        className={cn(
          'grid size-[1.625rem] shrink-0 place-items-center rounded-[0.4375rem]',
          !danger && 'bg-secondary'
        )}
      >
        <item.icon
          className={cn('size-[0.8125rem]', danger ? 'text-destructive' : 'text-muted-foreground')}
          aria-hidden
        />
      </span>
      <span className="grid min-w-0 flex-1 gap-px">
        <span
          className={cn(
            'text-[0.84375rem] leading-[1.0625rem] font-semibold',
            danger && 'text-danger-soft'
          )}
        >
          {item.title}
        </span>
        <span
          className={cn(
            'text-[0.71875rem] leading-[0.875rem]',
            danger ? 'text-muted-foreground' : 'text-ink-3'
          )}
        >
          {item.meta}
        </span>
      </span>
      {(item.soon || !item.url) && (
        <Badge variant="secondary" appearance="light" size="sm" className="shrink-0">
          Soon
        </Badge>
      )}
      {item.url && (
        <ChevronRight
          className={cn('size-3 shrink-0', danger ? 'text-destructive' : 'text-ink-faint')}
          aria-hidden
        />
      )}
    </>
  )
}

/** One group's card: a header with the row count, then its rows in two columns. */
function SettingsSection({ group, danger }: { group: SettingsGroup; danger?: boolean }) {
  const id = React.useId()

  return (
    <section
      aria-labelledby={id}
      className={cn(
        '@container overflow-hidden rounded-lg border',
        danger ? 'border-destructive/20 bg-card dark:bg-destructive/5' : 'bg-card'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b px-3.5 py-2.5',
          danger && 'border-destructive/20'
        )}
      >
        <h2
          id={id}
          className={cn(
            'flex items-center gap-2 font-mono text-[0.71875rem] leading-[0.875rem] font-semibold tracking-[0.0625rem] uppercase',
            danger ? 'text-danger-soft' : 'text-ink-faint'
          )}
        >
          <group.icon
            className={cn('size-[0.8125rem]', danger ? 'text-destructive' : 'text-ink-3')}
            aria-hidden
          />
          {group.title}
        </h2>
        {!danger && (
          <span className="bg-muted text-muted-foreground rounded-[0.25rem] px-[0.3125rem] py-px font-mono text-[0.71875rem] leading-3 font-semibold tabular-nums">
            {group.items.length}
          </span>
        )}
      </div>
      <ul className={cn('grid gap-1.5 px-3 py-2.5', !danger && '@xl:grid-cols-2')}>
        {group.items.map((item) => (
          <li key={item.title} className="grid">
            {item.url ? (
              <Link
                to={item.url}
                className={cn(
                  ROW,
                  danger
                    ? 'border-destructive/20 bg-card hover:bg-destructive/10 dark:bg-destructive/12 dark:hover:bg-destructive/20 border px-2.5 py-2'
                    : 'bg-muted hover:bg-accent'
                )}
              >
                <RowContent item={item} danger={danger} />
              </Link>
            ) : (
              <div aria-disabled className={cn(ROW, 'bg-muted')}>
                <RowContent item={item} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The settings index: a search over every page, then each group's card of rows. */
export default function SettingsNav() {
  const { data: security } = useQuery(queries.profile.security())
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

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

  const groups = security?.super_user ? [...SETTINGS_GROUPS, PLATFORM_GROUP] : SETTINGS_GROUPS

  // A search on a group's name lists all of it; otherwise only the rows that match.
  const term = query.trim().toLowerCase()
  const matches = (group: SettingsGroup): SettingsGroup =>
    !term || group.title.toLowerCase().includes(term)
      ? group
      : {
          ...group,
          items: group.items.filter((item) =>
            `${item.title} ${item.meta}`.toLowerCase().includes(term)
          ),
        }
  const shown = groups.map(matches).filter((group) => group.items.length > 0)
  const danger = matches(DANGER_GROUP)
  const empty = shown.length === 0 && danger.items.length === 0

  return (
    <SettingsPage>
      <nav aria-label="Control Center" className="grid gap-3.5">
        <label className="bg-card focus-within:ring-ring/50 flex items-center gap-2.25 rounded-[0.625rem] border px-3 py-2 focus-within:ring-[0.1875rem]">
          <Search className="text-ink-3 size-[0.8125rem] shrink-0" aria-hidden />
          <span className="sr-only">Search settings</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setQuery('')
            }}
            placeholder="Search settings, tools and providers"
            className="placeholder:text-ink-3 min-w-0 flex-1 bg-transparent text-ellipsis text-[0.84375rem] leading-[1.0625rem] outline-none pointer-coarse:text-base"
          />
          <kbd className="text-ink-3 bg-muted rounded-tag border px-[0.3125rem] py-0.5 font-mono text-[0.71875rem] leading-[0.6875rem] font-semibold pointer-coarse:hidden">
            {SEARCH_KEYS}
          </kbd>
        </label>

        {shown.map((group) => (
          <SettingsSection key={group.title} group={group} />
        ))}
        {danger.items.length > 0 && <SettingsSection group={danger} danger />}
        {empty && (
          <p
            role="status"
            className="text-muted-foreground py-10 text-center text-sm wrap-anywhere"
          >
            No settings match “{query.trim()}”.
          </p>
        )}
      </nav>
    </SettingsPage>
  )
}
