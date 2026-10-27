import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, Star } from 'lucide-react'
import React from 'react'

import { formatMailListDate, senderName } from '@/components/layout/mail/mail-data'
import {
  MobileMailBar,
  useMailAccount,
  useMailAccounts,
  useMailFolder,
} from '@/components/layout/mail/mail-panel'
import { Button } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

// The search shortcut as this platform writes it; Ctrl K works everywhere but a Mac.
const SEARCH_KEYS =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

/** The page of mail the URL points at: account, folder, label, search and page. */
export function useMailPage() {
  const folder = useMailFolder()
  const account = useMailAccount()
  const { label, q, page = 1 } = useSearch({ strict: false })
  const query = useQuery(
    queries.mails.list(account?.id, {
      folder: folder.id,
      importance: label,
      search: q,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
  )
  return { ...query, page, account, folder }
}

/** What the list shows instead of mail: no account, a first sync, a failed one, or an empty folder. */
function EmptyList() {
  const { isPending } = useMailAccounts()
  const account = useMailAccount()
  const { mask } = useHideEmails()

  if (isPending) return null
  if (!account) {
    return (
      <div className="grid justify-items-center gap-3 p-6 text-center text-sm">
        <p className="text-muted-foreground">No email account is connected to this organization.</p>
        <Button asChild size="sm">
          <Link to="/account">
            <Plus />
            Connect an account
          </Link>
        </Button>
      </div>
    )
  }
  if (!account.synced_at && !account.sync_error) {
    return (
      <p className="text-muted-foreground flex items-center justify-center gap-2 p-6 text-sm">
        <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" />
        Syncing {mask(account.email)}...
      </p>
    )
  }
  return <p className="text-muted-foreground p-4 text-center text-sm">No mail here.</p>
}

/** Middle column of the mailbox: the mail of the active folder and label. */
export default function MailList({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { mail: selectedId, q } = useSearch({ strict: false })
  const { data, isPending, isError, error, refetch, page, account, folder } = useMailPage()
  const [search, setSearch] = React.useState(q ?? '')
  // A term cleared or changed elsewhere (a folder link, the back button) shows in the box.
  const [shownQ, setShownQ] = React.useState(q)
  if (q !== shownQ) {
    setShownQ(q)
    setSearch(q ?? '')
  }
  const debounced = useDebounce({ value: search.trim(), delay: 300 })
  const searchRef = React.useRef<HTMLInputElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // ⌘K / Ctrl+K jumps to the search box.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
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

  const mails = data?.data ?? []
  const total = data?.metadata.total ?? 0
  const unreadCount = data?.metadata.unread ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const first = (page - 1) * PAGE_SIZE

  const goTo = (next: number) => {
    navigate({ to: '/mail', search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }) })
    scrollRef.current?.scrollTo({ top: 0 })
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <h2 className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">{folder.title}</span>
          {unreadCount > 0 && (
            <span className="text-muted-foreground text-xs">{unreadCount} unread</span>
          )}
        </h2>
        <label className="bg-muted/60 focus-within:ring-ring/50 ml-auto flex h-9 w-44 items-center gap-2 rounded-lg px-2.5 focus-within:ring-[3px]">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            ref={searchRef}
            placeholder="Search"
            aria-label="Search mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="text-muted-foreground text-xs pointer-coarse:hidden">{SEARCH_KEYS}</kbd>
        </label>
      </div>
      <MobileMailBar />
      {account?.sync_error && (
        <p role="alert" className="text-destructive border-b px-4 py-2 text-xs">
          Last sync failed: {account.sync_error}
        </p>
      )}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        aria-busy={isPending && !!account}
      >
        {isPending && account ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid gap-2 border-b px-4 py-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        ) : isError ? (
          <div role="alert" className="grid justify-items-center gap-3 p-6 text-center text-sm">
            <p className="text-destructive">{axiosErrorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        ) : mails.length === 0 ? (
          <EmptyList />
        ) : (
          mails.map((mail) => (
            <Link
              key={mail.id}
              to="/mail"
              search={(prev) => ({ ...prev, mail: mail.id })}
              aria-current={selectedId === mail.id ? 'page' : undefined}
              className={cn(
                'hover:bg-accent/50 grid grid-cols-[1rem_1fr] gap-x-2 border-b px-4 py-4 text-sm',
                selectedId === mail.id && 'bg-accent hover:bg-accent'
              )}
            >
              <span className="flex h-5 items-center justify-center">
                {/* Screen readers hear the state as text; the dot and star are only its picture. */}
                {!mail.is_read ? (
                  <>
                    <span className="bg-primary size-2 rounded-full" aria-hidden />
                    <span className="sr-only">Unread,</span>
                  </>
                ) : (
                  mail.is_starred && (
                    <>
                      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                      <span className="sr-only">Starred,</span>
                    </>
                  )
                )}
              </span>
              <div className="grid min-w-0 gap-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'truncate text-[15px]',
                      mail.is_read ? 'font-medium' : 'font-semibold'
                    )}
                  >
                    {senderName(mail)}
                  </span>
                  <span
                    className={cn(
                      'ml-auto shrink-0 text-xs',
                      mail.is_read ? 'text-muted-foreground' : 'text-foreground font-medium'
                    )}
                  >
                    {formatMailListDate(mail.received_at)}
                  </span>
                </div>
                <span className="truncate font-medium">{mail.subject || '(no subject)'}</span>
                {mail.teaser && (
                  <span className="text-muted-foreground line-clamp-2">{mail.teaser}</span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
      {pageCount > 1 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2">
          <span className="text-muted-foreground text-xs">
            {first + 1}–{first + mails.length} of {total}
          </span>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <Button
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => goTo(page - 1)}
                >
                  <ChevronLeft className="rtl:rotate-180" />
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className="text-muted-foreground px-2 text-xs">
                  {page} / {pageCount}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  aria-label="Next page"
                  disabled={page >= pageCount}
                  onClick={() => goTo(page + 1)}
                >
                  <ChevronRight className="rtl:rotate-180" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
