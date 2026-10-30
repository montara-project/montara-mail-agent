import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  FolderInput,
  Inbox,
  Mail,
  MailOpen,
  OctagonAlert,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react'
import React from 'react'

import type { Models } from '@/lib/api/models'
import type { MailBulkAction } from '@/lib/api/services/types/mail'

import Hint from '@/components/block/common/hint'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { formatMailListDate, senderName } from '@/components/layout/mail/mail-data'
import {
  MobileMailBar,
  useMailAccount,
  useMailAccounts,
  useMailFolder,
} from '@/components/layout/mail/mail-panel'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounce } from '@/hooks/use-debounce'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { axiosErrorMessage, toastProgress } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

/** The page sizes the list offers; the server caps a page at 100. */
const PAGE_SIZES = [10, 25, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 25

/** A ?limit= from the URL as a page size, the default for anything else. */
export const pageSize = (limit: unknown) =>
  PAGE_SIZES.find((size) => size === Number(limit)) ?? DEFAULT_PAGE_SIZE

// The search shortcut as this platform writes it; Ctrl K works everywhere but a Mac.
const SEARCH_KEYS =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

/** The page of mail the URL points at: account, folder, label, search, page and page size. */
export function useMailPage() {
  const folder = useMailFolder()
  const account = useMailAccount()
  const { label, q, page = 1, limit } = useSearch({ strict: false })
  const size = pageSize(limit)
  const query = useQuery(
    queries.mails.list(account?.id, {
      folder: folder.id,
      importance: label,
      search: q,
      offset: (page - 1) * size,
      limit: size,
    })
  )
  return { ...query, page, size, account, folder }
}

/** What the list shows instead of mail: no account, a first sync, a failed one, or an empty folder. */
function EmptyList() {
  const { isPending } = useMailAccounts()
  const account = useMailAccount()
  const folder = useMailFolder()
  const { mask } = useHideEmails()

  if (isPending) return null
  if (!account) {
    return (
      <div className="grid h-full content-center justify-items-center gap-3 p-6 text-center text-sm">
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
      <p className="text-muted-foreground flex h-full items-center justify-center gap-2 p-6 text-sm">
        <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" />
        Syncing {mask(account.email)}...
      </p>
    )
  }
  return (
    <div className="text-muted-foreground grid h-full content-center justify-items-center gap-2 p-6 text-center text-sm">
      <folder.icon className="size-6 opacity-60" aria-hidden />
      <p>No mail here.</p>
    </div>
  )
}

/**
 * A row's columns: the checkbox, then the mail, 12px apart. The header puts
 * its checkbox and title on the same lines (CHECK_GAP), so they align. The
 * unread dot or star sits in the row's left padding, not a column of its own.
 */
const ROW_COLUMNS = 'grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3'
const CHECK_GAP = 'me-1' // + the header's gap-2: the same 12px as gap-x-3

/** The folders a selection can move to, as the Move to menu lists them. */
const MOVE_TARGETS: { folder: Models.MailMoveTarget; label: string; icon: typeof Inbox }[] = [
  { folder: 'inbox', label: 'Inbox', icon: Inbox },
  { folder: 'archive', label: 'Archive', icon: Archive },
  { folder: 'spam', label: 'Spam', icon: OctagonAlert },
  { folder: 'trash', label: 'Trash', icon: Trash2 },
]

// The header's selection motion: quick, eased out, no bounce, so a click on
// select all feels immediate. Actions come in left to right and leave right
// to left.
const EASE_OUT = [0.2, 0, 0, 1] as const
const ACTIONS: Variants = {
  hidden: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
  shown: { transition: { staggerChildren: 0.035 } },
}
const ACTION: Variants = {
  hidden: { opacity: 0, x: -6, scale: 0.9, transition: { duration: 0.14, ease: EASE_OUT } },
  shown: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.2, ease: EASE_OUT } },
}

/** An icon button for a bulk action, named by its tooltip. */
function ActionButton({
  label,
  icon: Icon,
  ...props
}: { label: string; icon: typeof Inbox } & React.ComponentProps<typeof Button>) {
  return (
    <motion.span variants={ACTION} className="flex">
      <Hint label={label}>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 pointer-coarse:size-10"
          aria-label={label}
          {...props}
        >
          <Icon />
        </Button>
      </Hint>
    </motion.span>
  )
}

/** The progress word for a bulk action, e.g. "Archiving". */
function bulkVerb(action: MailBulkAction, folder: string) {
  if (action.action !== 'move') {
    if (action.action === 'trash') return folder === 'trash' ? 'Deleting' : 'Moving to trash'
    return `Marking as ${action.action}`
  }
  const target = MOVE_TARGETS.find((item) => item.folder === action.folder)
  return action.folder === 'archive' ? 'Archiving' : `Moving to ${target?.label ?? action.folder}`
}

/**
 * What the selection can do from this folder: archive, spam (or not spam
 * from the spam folder), trash (or delete for good from the trash), read or
 * unread, and move to another folder.
 */
function BulkActions({
  folder,
  mails,
  onDone,
}: {
  folder: string
  mails: Models.Mail[]
  onDone: (ids: string[]) => void
}) {
  const bulk = useMutation(queries.mails.bulk())
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const ids = mails.map((mail) => mail.id)
  const allRead = mails.every((mail) => mail.is_read)

  // A loading toast that turns into the outcome. The promise, not mutate's
  // callbacks, carries it: the bar unmounts once the moved mails leave the list.
  const run = async (action: MailBulkAction) => {
    const count = `${ids.length} ${ids.length === 1 ? 'mail' : 'mails'}`
    const progress = toastProgress(`${bulkVerb(action, folder)} ${count}...`)
    try {
      const res = await bulk.mutateAsync({ ...action, ids })
      progress.success(res.message ?? 'Done')
      onDone(ids)
    } catch (error) {
      progress.error(error)
    }
  }
  const moveTo = (target: Models.MailMoveTarget) => run({ action: 'move', folder: target })

  return (
    <motion.div
      variants={ACTIONS}
      initial="hidden"
      animate="shown"
      exit="hidden"
      className="absolute inset-y-0 start-0 flex items-center"
      aria-busy={bulk.isPending}
    >
      {folder !== 'archive' && (
        <ActionButton
          label="Archive"
          icon={Archive}
          disabled={bulk.isPending}
          onClick={() => moveTo('archive')}
        />
      )}
      {folder === 'spam' ? (
        <ActionButton
          label="Not spam"
          icon={Inbox}
          disabled={bulk.isPending}
          onClick={() => moveTo('inbox')}
        />
      ) : (
        <ActionButton
          label="Report spam"
          icon={OctagonAlert}
          disabled={bulk.isPending}
          onClick={() => moveTo('spam')}
        />
      )}
      <ActionButton
        label={folder === 'trash' ? 'Delete forever' : 'Move to trash'}
        icon={Trash2}
        disabled={bulk.isPending}
        onClick={() => (folder === 'trash' ? setConfirmDelete(true) : run({ action: 'trash' }))}
      />
      <ActionButton
        label={allRead ? 'Mark as unread' : 'Mark as read'}
        icon={allRead ? Mail : MailOpen}
        disabled={bulk.isPending}
        onClick={() => run({ action: allRead ? 'unread' : 'read' })}
      />
      <motion.span variants={ACTION} className="flex">
        <DropdownMenu>
          <Hint label="Move to">
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 pointer-coarse:size-10"
                aria-label="Move to"
                disabled={bulk.isPending}
              >
                <FolderInput />
              </Button>
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel className="text-muted-foreground text-xs">Move to</DropdownMenuLabel>
            {MOVE_TARGETS.filter((target) => target.folder !== folder).map((target) => (
              <DropdownMenuItem key={target.folder} onSelect={() => moveTo(target.folder)}>
                <target.icon />
                {target.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.span>

      <SimpleAlertDialog
        title={`Delete ${mails.length} ${mails.length === 1 ? 'mail' : 'mails'} forever?`}
        description="They are removed from the mail server too. This cannot be undone."
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onConfirm={() => {
          setConfirmDelete(false)
          run({ action: 'trash' })
        }}
        confirmText="Delete forever"
        variant="destructive"
      />
    </motion.div>
  )
}

/** Middle column of the mailbox: the mail of the active folder and label. */
export default function MailList({ className }: { className?: string }) {
  const navigate = useNavigate()
  const { mail: selectedId, q } = useSearch({ strict: false })
  const { data, isPending, isError, error, refetch, page, size, account, folder } = useMailPage()
  const [search, setSearch] = React.useState(q ?? '')
  // A term cleared or changed elsewhere (a folder link, the back button) shows in the box.
  const [shownQ, setShownQ] = React.useState(q)
  if (q !== shownQ) {
    setShownQ(q)
    setSearch(q ?? '')
  }
  const debounced = useDebounce({ value: search.trim(), delay: 300 })
  // The selection lives on one page: another page, folder, label or search
  // starts it empty.
  const { label } = useSearch({ strict: false })
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set())
  const pageKey = [account?.id, folder.id, label, q, page, size].join('|')
  const [seenPageKey, setSeenPageKey] = React.useState(pageKey)
  if (pageKey !== seenPageKey) {
    setSeenPageKey(pageKey)
    setSelected(new Set())
  }
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
  // Only what is still on the page counts, so a refetch drops moved mail.
  const selectedMails = mails.filter((mail) => selected.has(mail.id))
  const allSelected = mails.length > 0 && selectedMails.length === mails.length
  const selecting = selectedMails.length > 0
  let selectAllState: boolean | 'indeterminate' = false
  if (allSelected) selectAllState = true
  else if (selecting) selectAllState = 'indeterminate'
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  // A bulk action that took the open mail away closes it too.
  const afterBulk = (ids: string[]) => {
    setSelected(new Set())
    if (selectedId && ids.includes(selectedId)) {
      navigate({ to: '/mail', search: (prev) => ({ ...prev, mail: undefined }) })
    }
  }
  const total = data?.metadata.total ?? 0
  const unreadCount = data?.metadata.unread ?? 0
  const pageCount = Math.max(1, Math.ceil(total / size))
  const first = (page - 1) * size

  // A new size starts from the first page; the default stays out of the URL.
  const setSize = (next: number) => {
    navigate({
      to: '/mail',
      search: (prev) => ({
        ...prev,
        limit: next === DEFAULT_PAGE_SIZE ? undefined : next,
        page: undefined,
      }),
    })
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const goTo = (next: number) => {
    navigate({ to: '/mail', search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }) })
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const content = () => {
    if (isPending && account) {
      return Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="grid gap-2 border-b px-4 py-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))
    }
    if (isError) {
      return (
        <div role="alert" className="grid justify-items-center gap-3 p-6 text-center text-sm">
          <p className="text-destructive">{axiosErrorMessage(error)}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw />
            Try again
          </Button>
        </div>
      )
    }
    if (mails.length === 0) return <EmptyList />
    return mails.map((mail) => {
      const isSelected = selected.has(mail.id)
      return (
        // The link stretches over the row; the checkbox sits above it.
        <div
          key={mail.id}
          className={cn(
            'hover:bg-accent/50 relative grid border-b px-4 py-4 text-sm',
            ROW_COLUMNS,
            // Unread mail is tinted, so it stands out without reading the dot.
            !mail.is_read && 'bg-blue-500/[0.06] dark:bg-blue-400/[0.08]',
            isSelected && 'bg-accent/40',
            selectedId === mail.id && 'bg-accent hover:bg-accent'
          )}
        >
          <span className="relative z-10 flex h-5 items-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(on) => toggle(mail.id, on === true)}
              aria-label={`Select ${senderName(mail)}: ${mail.subject || '(no subject)'}`}
              className="after:absolute after:-inset-2.5 after:content-['']"
            />
          </span>
          {/* In the left padding, centred on the first line. Screen readers hear
              the state as text; the dot and star are only its picture. */}
          <span className="absolute start-0 top-4 flex h-5 w-4 items-center justify-center">
            {!mail.is_read && (
              <>
                <span className="size-2.5 rounded-full bg-blue-500 dark:bg-blue-400" aria-hidden />
                <span className="sr-only">Unread,</span>
              </>
            )}
            {mail.is_read && mail.is_starred && (
              <>
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden />
                <span className="sr-only">Starred,</span>
              </>
            )}
          </span>
          <Link
            to="/mail"
            search={(prev) => ({ ...prev, mail: mail.id })}
            aria-current={selectedId === mail.id ? 'page' : undefined}
            // grid-cols-1 is minmax(0, 1fr): an implicit auto column would grow to
            // a long sender's full width and push the row sideways.
            className="grid min-w-0 grid-cols-1 gap-1 outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
          >
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
            <span className={cn('truncate', mail.is_read ? 'font-medium' : 'font-semibold')}>
              {mail.subject || '(no subject)'}
            </span>
            {mail.teaser && (
              <span className="text-muted-foreground line-clamp-2">{mail.teaser}</span>
            )}
          </Link>
        </div>
      )
    })
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <MotionConfig reducedMotion="user">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          {mails.length > 0 && (
            <Checkbox
              checked={selectAllState}
              onCheckedChange={() =>
                setSelected(allSelected ? new Set() : new Set(mails.map((mail) => mail.id)))
              }
              aria-label={allSelected ? 'Clear the selection' : 'Select all on this page'}
              className={CHECK_GAP}
            />
          )}
          {/* The title takes what the actions leave. A phone has no room for the
              count, and a count cut to its first digit would misread, so it hides;
              the select-all box still shows whether mail is selected. */}
          <h2 className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="shrink-0 text-lg font-semibold">{folder.title}</span>
            {/* "N unread" and "N selected" cross-fade; the count itself just updates. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {selecting ? (
                <motion.span
                  key="selected"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="text-muted-foreground hidden truncate text-xs tabular-nums sm:inline"
                >
                  {selectedMails.length} selected
                </motion.span>
              ) : (
                unreadCount > 0 && (
                  <motion.span
                    key="unread"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                    className="text-muted-foreground hidden truncate text-xs sm:inline"
                  >
                    {unreadCount} unread
                  </motion.span>
                )
              )}
            </AnimatePresence>
          </h2>
          {/* The actions and the search share this space and cross-fade, so
              nothing around them shifts. The search stays mounted for ⌘K. */}
          {/* Wide enough for the five actions, at touch size too. */}
          <div className="relative flex h-9 w-44 shrink-0 items-center justify-end pointer-coarse:w-52">
            <AnimatePresence>
              {selecting && (
                <BulkActions folder={folder.id} mails={selectedMails} onDone={afterBulk} />
              )}
            </AnimatePresence>
            <motion.label
              animate={
                selecting ? { opacity: 0, x: 8, scale: 0.98 } : { opacity: 1, x: 0, scale: 1 }
              }
              transition={{ duration: 0.18, ease: EASE_OUT }}
              inert={selecting}
              aria-hidden={selecting}
              className={cn(
                'bg-muted/60 focus-within:ring-ring/50 flex h-9 w-full items-center gap-2 rounded-lg px-2.5 focus-within:ring-[3px]',
                selecting && 'pointer-events-none'
              )}
            >
              <Search className="text-muted-foreground size-4 shrink-0" />
              <input
                ref={searchRef}
                placeholder="Search"
                aria-label="Search mail"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <kbd className="text-muted-foreground text-xs pointer-coarse:hidden">
                {SEARCH_KEYS}
              </kbd>
            </motion.label>
          </div>
        </div>
      </MotionConfig>
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
        {content()}
      </div>
      {total > 0 && (
        // On a phone the floating compose button sits over the right end.
        <div className="flex shrink-0 items-center gap-2 border-t px-4 py-2 max-md:pe-20">
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {first + 1}–{first + mails.length} of {total}
          </span>
          <Select value={String(size)} onValueChange={(value) => setSize(Number(value))}>
            <SelectTrigger
              size="sm"
              // As quiet as the page buttons beside it: no fill until hovered or open.
              className="text-muted-foreground hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground ms-auto h-7 w-auto gap-1 border-transparent bg-transparent px-2 text-xs font-normal shadow-none"
              aria-label="Mails per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              {PAGE_SIZES.map((option) => (
                <SelectItem key={option} value={String(option)} className="text-xs">
                  {option} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Pagination className={cn('mx-0 w-auto', pageCount <= 1 && 'hidden')}>
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
