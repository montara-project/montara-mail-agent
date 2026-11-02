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
  Star,
  Trash2,
} from 'lucide-react'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react'
import React from 'react'

import type { Models } from '@/lib/api/models'
import type { MailScope } from '@/lib/api/queries/mail'
import type { MailBulkAction } from '@/lib/api/services/types/mail'

import Hint from '@/components/block/common/hint'
import { providerColor } from '@/components/block/common/provider-badge'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { formatMailListDate, mailInitials, senderName } from '@/components/layout/mail/mail-data'
import {
  AccountFlag,
  MobileMailBar,
  useFlaggedAccount,
  useMailAccount,
  useMailAccounts,
  useMailFolder,
  useSplitInbox,
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
import { useActiveOrganization } from '@/hooks/use-active-organization'
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

/** The accounts on screen: the open one, or all of them in the global inbox. */
function useShownAccounts() {
  const split = useSplitInbox()
  const account = useMailAccount()
  const { data: accounts } = useMailAccounts()
  if (split === undefined) return []
  return split ? (account ? [account] : []) : (accounts ?? [])
}

/**
 * The page of mail the URL points at: account or global inbox, folder, label,
 * search, page and page size. It waits for the accounts and the Split inbox
 * choice, so a split user never sees the global inbox flash by and a flag never
 * pops in under a row.
 */
export function useMailPage() {
  const folder = useMailFolder()
  const account = useMailAccount()
  const shown = useShownAccounts()
  const { organization } = useActiveOrganization()
  const { label, q, page = 1, limit } = useSearch({ strict: false })
  const size = pageSize(limit)
  let scope: MailScope | undefined
  if (account) scope = { accountId: account.id }
  else if (shown.length > 0 && organization) scope = { organizationId: organization.id }
  const query = useQuery(
    queries.mails.list(scope, {
      folder: folder.id,
      importance: label,
      search: q,
      offset: (page - 1) * size,
      limit: size,
    })
  )
  return { ...query, page, size, account, shown, folder, scope }
}

/** What the list shows instead of mail: no account, a first sync, or an empty folder. */
function EmptyList() {
  const { isPending, isError, error, refetch } = useMailAccounts()
  const split = useSplitInbox()
  const shown = useShownAccounts()
  const folder = useMailFolder()
  const { mask } = useHideEmails()

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
  if (isPending || split === undefined) return null
  if (shown.length === 0) {
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
  const syncing = shown.filter((account) => !account.synced_at && !account.sync_error)
  if (syncing.length > 0) {
    return (
      <p className="text-muted-foreground flex h-full items-center justify-center gap-2 p-6 text-center text-sm">
        <RefreshCw className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />
        <span className="min-w-0 wrap-anywhere">
          {syncing.length === 1
            ? `Syncing ${mask(syncing[0].email)}...`
            : 'Syncing your accounts...'}
        </span>
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
 * A row's columns: the avatar slot, then the mail, 10px apart. On hover or
 * selection the row's checkbox takes the avatar's place, so nothing shifts.
 */
const ROW_COLUMNS = 'grid-cols-[auto_minmax(0,1fr)] gap-x-2.5'
const CHECK_GAP = 'me-1' // + the header's gap-2: the same 12px as gap-x-3
// Raised off the dark card, where the default background reads as a hole.
const CHECK_SURFACE = 'dark:data-[state=unchecked]:bg-input/30'
// Viewport breakpoints: the list is w-80 from md to lg, too narrow for the count.
const COUNT_VISIBILITY = 'hidden sm:inline md:hidden lg:inline'

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
          className="size-8 pointer-coarse:size-11"
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
      className="absolute inset-y-0 end-0 flex items-center"
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
                className="size-8 pointer-coarse:size-11"
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
  const { data, isPending, isError, error, refetch, page, size, account, shown, folder, scope } =
    useMailPage()
  const flaggedAccount = useFlaggedAccount()
  const { mask } = useHideEmails()
  const failed = shown.filter((item) => item.sync_error)
  // The selection lives on one page: another page, folder, label or search
  // starts it empty.
  const { label } = useSearch({ strict: false })
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set())
  const pageKey = [JSON.stringify(scope), folder.id, label, q, page, size].join('|')
  const [seenPageKey, setSeenPageKey] = React.useState(pageKey)
  if (pageKey !== seenPageKey) {
    setSeenPageKey(pageKey)
    setSelected(new Set())
  }
  const scrollRef = React.useRef<HTMLDivElement>(null)

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
    if (isPending && scope) {
      return Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-start gap-2.5 border-b px-3.5 py-2.5">
          <Skeleton className="size-6.5 shrink-0 rounded-[7px]" />
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-3/4" />
            {/* The rows' account chip, so they don't jump in taller. */}
            {!account && shown.length > 1 && <Skeleton className="mt-0.5 h-5 w-40 rounded-chip" />}
          </div>
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
      const flag = flaggedAccount(mail)
      // The avatar carries the mailbox's provider hue when one is flagged.
      const tint = flag ? providerColor(flag.provider) : undefined
      return (
        // The link stretches over the row; the checkbox sits above it.
        <div
          key={mail.id}
          className={cn(
            'group/row hover:bg-accent/50 relative grid border-b px-3.5 py-2.5 text-sm',
            ROW_COLUMNS,
            // Unread mail keeps a quiet tint; the dot in the meta tells it too.
            !mail.is_read && 'bg-muted',
            isSelected && 'bg-accent',
            selectedId === mail.id && 'bg-accent hover:bg-accent'
          )}
        >
          {/* On hover or selection the checkbox takes the avatar's place. */}
          <span className="relative z-10 grid size-6.5 shrink-0 place-items-center">
            <span
              aria-hidden
              className={cn(
                'absolute inset-0 flex items-center justify-center rounded-[7px] border text-[11px] font-bold transition-opacity',
                !tint && 'border-border/60 bg-secondary text-muted-foreground',
                'group-hover/row:opacity-0',
                isSelected && 'opacity-0'
              )}
              style={
                tint
                  ? {
                      color: tint,
                      borderColor: `color-mix(in srgb, ${tint} 20%, transparent)`,
                      backgroundColor: `color-mix(in srgb, ${tint} 12%, transparent)`,
                    }
                  : undefined
              }
            >
              {mailInitials(senderName(mail))}
            </span>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(on) => toggle(mail.id, on === true)}
              aria-label={`Select ${mask(senderName(mail))}: ${mail.subject || '(no subject)'}`}
              className={cn(
                "absolute inset-0 m-auto size-4 after:absolute after:-inset-2.5 after:content-['']",
                'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
                isSelected && 'opacity-100',
                CHECK_SURFACE
              )}
            />
          </span>
          {/* Screen readers hear the state as text; the meta's dot is only its picture. */}
          {!mail.is_read && <span className="sr-only">Unread,</span>}
          <Link
            to="/mail"
            search={(prev) => ({ ...prev, mail: mail.id })}
            aria-current={selectedId === mail.id ? 'page' : undefined}
            className="flex min-w-0 items-start gap-2.5 outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
          >
            <span className="grid min-w-0 flex-1 self-start gap-0.5">
              {/* dir="auto": an Arabic or Hebrew mail reads right to left, punctuation included. */}
              <span dir="auto" className="flex min-w-0 items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'min-w-0 truncate text-[11.5px]',
                    mail.is_read ? 'font-medium' : 'font-bold'
                  )}
                >
                  {mask(senderName(mail))}
                </span>
                <span className="text-ink-3 shrink-0 font-mono text-[10.5px] whitespace-nowrap tabular-nums">
                  {formatMailListDate(mail.received_at)}
                </span>
              </span>
              <span
                dir="auto"
                className={cn(
                  'min-w-0 truncate',
                  mail.is_read
                    ? 'text-muted-foreground font-medium'
                    : 'text-ink-strong font-semibold text-[11.5px]'
                )}
              >
                {mail.subject || '(no subject)'}
              </span>
              {mail.teaser && (
                <span dir="auto" className="text-ink-3 min-w-0 truncate text-[10.5px]">
                  {mail.teaser}
                </span>
              )}
              <span className="mt-0.5 flex items-center gap-1.5">
                {flag && (
                  <>
                    <span className="sr-only">Account:</span>
                    {/* Above the link's stretched overlay, so its tooltip shows; a click still opens the mail. */}
                    <AccountFlag account={flag} className="relative z-10 rounded-chip" />
                  </>
                )}
                {mail.is_starred && (
                  <>
                    <Star className="fill-warning text-warning size-3" aria-hidden />
                    <span className="sr-only">Starred,</span>
                  </>
                )}
                {!mail.is_read && (
                  <span aria-hidden className="bg-accent-ink size-1.5 shrink-0 rounded-full" />
                )}
              </span>
            </span>
          </Link>
        </div>
      )
    })
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <MotionConfig reducedMotion="user">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          {selecting && (
            <Checkbox
              checked={selectAllState}
              onCheckedChange={() =>
                setSelected(allSelected ? new Set() : new Set(mails.map((mail) => mail.id)))
              }
              aria-label={allSelected ? 'Clear the selection' : 'Select all on this page'}
              className={cn(CHECK_GAP, CHECK_SURFACE)}
            />
          )}
          {/* The title takes what the actions leave. A phone or the narrow tablet list
              has no room for the count, and a count cut to its first digit would
              misread, so it hides; the select-all box still shows whether mail is selected. */}
          <h2 className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="shrink-0 text-sm font-bold">{folder.title}</span>
            {/* "N unread" and "N selected" cross-fade; the count itself just updates. */}
            <AnimatePresence mode="popLayout" initial={false}>
              {selecting ? (
                <motion.span
                  key="selected"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className={`bg-secondary text-muted-foreground truncate rounded-tag px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${COUNT_VISIBILITY}`}
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
                    className={`bg-accent-ink/15 text-accent-soft font-mono text-[10.5px] font-semibold truncate rounded-chip px-1.5 py-0.5 tabular-nums ${COUNT_VISIBILITY}`}
                  >
                    {unreadCount} new
                  </motion.span>
                )
              )}
            </AnimatePresence>
          </h2>
          {/* Wide enough for the five actions, at touch size too. The refresh
              cross-fades away while a selection shows the bulk actions. */}
          <div className="relative flex h-9 w-40 shrink-0 items-center justify-end pointer-coarse:w-55">
            <motion.span
              animate={
                selecting ? { opacity: 0, x: 8, scale: 0.98 } : { opacity: 1, x: 0, scale: 1 }
              }
              transition={{ duration: 0.18, ease: EASE_OUT }}
              inert={selecting}
              aria-hidden={selecting}
              className={cn('flex', selecting && 'pointer-events-none')}
            >
              <Hint label="Refresh">
                <Button
                  variant="secondary"
                  mode="icon"
                  size="xs"
                  aria-label="Refresh mail"
                  disabled={isPending && !!scope}
                  onClick={() => refetch()}
                >
                  <RefreshCw />
                </Button>
              </Hint>
            </motion.span>
            <AnimatePresence>
              {selecting && (
                <BulkActions folder={folder.id} mails={selectedMails} onDone={afterBulk} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </MotionConfig>
      <MobileMailBar />
      {failed.length > 0 && (
        // Scrolls on its own: many failing accounts must not push the mail away.
        <div
          role="alert"
          className="text-destructive grid max-h-20 shrink-0 gap-1 overflow-y-auto border-b px-4 py-2 text-xs wrap-anywhere"
        >
          {failed.map((item) => (
            <p key={item.id}>
              Last sync failed{account ? '' : ` for ${mask(item.email)}`}:{' '}
              {mask(item.sync_error ?? '')}
            </p>
          ))}
        </div>
      )}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
        aria-busy={isPending && !!scope}
      >
        {content()}
      </div>
      {total > 0 && (
        // On a phone the floating compose button sits over the right end.
        <div className="flex shrink-0 items-center gap-2 border-t px-4 py-2 max-md:pe-20">
          <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
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
