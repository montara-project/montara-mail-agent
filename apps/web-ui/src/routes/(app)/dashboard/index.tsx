import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronRight,
  Inbox,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
  SquarePen,
} from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'
import type { MailScope } from '@/lib/api/queries/mail'

import { ProviderIcon } from '@/components/block/account/connector-list'
import QueryState from '@/components/block/common/query-state'
import SectionCard from '@/components/block/common/section-card'
import { SettingsPage } from '@/components/block/common/settings-card'
import MailStats from '@/components/block/dashboard/mail-stats'
import ComposeSheet from '@/components/block/mail/compose-sheet'
import { senderName } from '@/components/layout/mail/mail-data'
import { useMailAccounts, useSplitInbox } from '@/components/layout/mail/mail-panel'
import { SEARCH_KEYS } from '@/components/layout/mail/mail-search'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { shortDay } from '@/lib/date'
import { cn } from '@/lib/utils'

/** Rows shown per card; the cards link to Mail for the rest. */
const RECENT_LIMIT = 6
const QUARANTINE_LIMIT = 3

/** A card head's quiet link; the extra block padding keeps a 24px target. */
const HEAD_LINK =
  'text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-chip -my-1 flex items-center gap-1 py-1 text-[0.78125rem] font-medium outline-none focus-visible:ring-[0.1875rem] [&_svg]:size-3'
/** An edge-to-edge row inside a card; the card clips its corners. */
const ROW_LINK =
  'hover:bg-accent/50 focus-visible:ring-ring/50 outline-none focus-visible:ring-[0.1875rem] focus-visible:ring-inset'

/**
 * Deterministic per-sender avatar color from the design's palette, so each
 * sender keeps the same tint across visits.
 */
const AVATAR_COLORS = ['#2c8bef', '#6d4aff', '#ea4335', '#3693f3', '#f59e0b', '#22c55e']

function avatarColor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** The scope both mail cards read: every account of the active organization. */
function useOrgScope(): MailScope | undefined {
  const { organization } = useActiveOrganization()
  return organization ? { organizationId: organization.id } : undefined
}

/** Search mail (lands in Mail with the term), Filter (lives in Mail), and Compose. */
function DashboardToolbar() {
  const navigate = useNavigate()
  const { data: accounts } = useMailAccounts()
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [term, setTerm] = React.useState('')
  const [composing, setComposing] = React.useState(false)

  // ⌘K / Ctrl+K jumps to the search box, as it does on the mail page.
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

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const q = term.trim()
    if (q) navigate({ to: '/mail', search: { q } })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form onSubmit={submit} className="min-w-56 flex-1">
        <InputWrapper className="bg-card border-border gap-2 rounded-md">
          <Search className="size-[0.9375rem]" />
          <Input
            ref={searchRef}
            placeholder="Search messages, senders or attachments"
            aria-label="Search mail"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="text-[0.84375rem] pointer-coarse:text-base"
          />
          <kbd className="bg-secondary rounded-tag px-1.5 py-0.5 font-sans text-[0.71875rem] font-semibold text-muted-foreground">
            {SEARCH_KEYS}
          </kbd>
        </InputWrapper>
      </form>
      {/* The folder and label filters live on the mail page. */}
      <Button
        asChild
        variant="outline"
        className="bg-card border-border text-muted-foreground text-[0.84375rem] shadow-none"
      >
        <Link to="/mail">
          <SlidersHorizontal className="size-3.5" />
          Filter
        </Link>
      </Button>
      <Button
        onClick={() => setComposing(true)}
        disabled={!accounts?.length}
        className="gap-[0.4375rem] px-3.5 text-[0.84375rem] font-bold"
      >
        <SquarePen className="size-3.5" />
        Compose
      </Button>
      <ComposeSheet
        open={composing}
        onOpenChange={setComposing}
        accounts={accounts}
        defaultAccountId={accounts?.[0]?.id}
      />
    </div>
  )
}

/** One recent message: initial avatar, sender · subject, snippet, time + unread dot. */
function MessageRow({ mail }: { mail: Models.Mail }) {
  const { mask } = useHideEmails()
  const name = senderName(mail)
  const color = avatarColor(mail.from_email || name)
  return (
    <Link
      to="/mail"
      search={{ mail: mail.id }}
      className={cn(
        ROW_LINK,
        'flex items-center gap-3 px-4 py-[0.6875rem]',
        !mail.is_read && 'bg-muted'
      )}
    >
      <span
        className="flex size-[2.125rem] shrink-0 items-center justify-center rounded-full border text-[0.84375rem] font-bold uppercase"
        style={{
          backgroundColor: `${color}1f`,
          borderColor: `${color}33`,
          color,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
        <span className="flex items-baseline gap-[0.4375rem] text-[0.84375rem] leading-[1.0625rem]">
          <span
            className={cn(
              'max-w-[60%] shrink-0 truncate',
              mail.is_read ? 'text-ink-strong font-semibold' : 'font-bold'
            )}
          >
            {mask(name)}
          </span>
          {mail.subject && (
            <span
              className={cn(
                'min-w-0 truncate',
                mail.is_read ? 'text-muted-foreground font-medium' : 'text-ink-strong font-semibold'
              )}
            >
              · {mail.subject}
            </span>
          )}
        </span>
        {mail.teaser && (
          <span className="text-ink-3 truncate text-[0.78125rem] leading-4">{mail.teaser}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-[0.5625rem]">
        <span
          className={cn(
            'min-w-13 text-end text-[0.75rem] font-medium tabular-nums',
            mail.is_read ? 'text-ink-3' : 'text-muted-foreground'
          )}
        >
          {shortDay(new Date(mail.received_at))}
        </span>
        {/* A read row keeps the dot's slot, so the times stay in one column. */}
        <span
          aria-hidden
          className={cn('size-1.5 rounded-full', !mail.is_read && 'bg-foreground')}
        />
        {!mail.is_read && <span className="sr-only">Unread</span>}
      </span>
    </Link>
  )
}

/** The inbox's latest mail, across the organization's accounts. */
function RecentMessages() {
  const scope = useOrgScope()
  const { data, isPending, isError, error, refetch } = useQuery(
    queries.mails.list(scope, { folder: 'inbox', offset: 0, limit: RECENT_LIMIT })
  )
  const mails = data?.data ?? []
  const unread = data?.metadata.unread ?? 0

  return (
    <SectionCard
      title="Recent messages"
      badge={
        unread > 0 && (
          <span className="bg-secondary text-muted-foreground rounded-tag px-[0.4375rem] py-0.5 text-[0.71875rem] leading-[0.875rem] font-semibold tabular-nums">
            {unread} new
          </span>
        )
      }
      toolbar={
        <Link to="/mail" className={HEAD_LINK}>
          View all
          <ArrowRight />
        </Link>
      }
    >
      <QueryState
        isPending={isPending && !!scope}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={mails.length === 0}
        loading={
          <div className="grid gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        }
        empty={
          <p className="text-muted-foreground py-6 text-center text-sm">
            No mail in the inbox yet.
          </p>
        }
      >
        <div className="-m-4 divide-y">
          {mails.map((mail) => (
            <MessageRow key={mail.id} mail={mail} />
          ))}
        </div>
      </QueryState>
    </SectionCard>
  )
}

/** The design's quiet Restore: moves the mail back to the inbox, where it
 * lands as ordinary mail again. The row leaves the list when it lands. */
function RestoreButton({ mailId, sender }: { mailId: string; sender: string }) {
  const move = useMutation(queries.mails.move(mailId))
  return (
    <Button
      variant="outline"
      size="xs"
      aria-label={`Restore mail from ${sender}`}
      className="border-border text-ink-strong rounded-chip h-5 shrink-0 bg-transparent px-2 text-[0.71875rem] font-semibold shadow-none pointer-coarse:h-9"
      disabled={move.isPending}
      onClick={() => move.mutate('inbox', { onError: toastAxiosError })}
    >
      {move.isPending && <Loader2 className="size-3 animate-spin" aria-hidden />}
      Restore
    </Button>
  )
}

/**
 * Mail the server held in spam. The API carries no per-mail reason, so a row
 * has no reason chip, only its sender and subject beside the Restore action;
 * "not spam" verdicts live on the mail page.
 */
function Quarantined() {
  const scope = useOrgScope()
  const { mask } = useHideEmails()
  const { data, isPending, isError, error, refetch } = useQuery(
    queries.mails.list(scope, { folder: 'spam', offset: 0, limit: QUARANTINE_LIMIT })
  )
  const mails = data?.data ?? []
  const total = data?.metadata.total ?? 0

  return (
    <SectionCard
      title="Quarantined"
      badge={
        total > 0 && (
          <span className="bg-warning/12 text-warning-ink rounded-tag px-1.5 py-0.5 text-[0.71875rem] leading-[0.875rem] font-bold tabular-nums">
            {total}
          </span>
        )
      }
      toolbar={
        <Link to="/mail" search={{ folder: 'spam' }} className={HEAD_LINK}>
          Review all
          <ChevronRight />
        </Link>
      }
    >
      <QueryState
        isPending={isPending && !!scope}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={mails.length === 0}
        loading={
          <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-md" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        }
        empty={
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nothing is quarantined. Suspicious mail will show up here.
          </p>
        }
      >
        <div className="-m-4">
          {mails.map((mail) => {
            const sender = mask(mail.from_email || senderName(mail))
            return (
              <div
                key={mail.id}
                className="hover:bg-accent/50 flex items-center gap-[0.6875rem] px-4 py-[0.5625rem]"
              >
                <span className="bg-warning/8 text-warning flex size-[1.625rem] shrink-0 items-center justify-center rounded-[0.4375rem]">
                  <ShieldX className="size-[0.8125rem]" aria-hidden />
                </span>
                <div className="grid min-w-0 flex-1 gap-px">
                  <span className="text-ink-strong truncate text-xs leading-4 font-semibold">
                    {sender}
                  </span>
                  <span className="text-ink-3 truncate text-[0.78125rem] leading-4">
                    {mail.subject || '(no subject)'}
                  </span>
                </div>
                <RestoreButton mailId={mail.id} sender={sender} />
              </div>
            )
          })}
        </div>
      </QueryState>
    </SectionCard>
  )
}

/** The organization's connected mailboxes, newest unread first is the server's order. */
function Mailboxes() {
  const split = useSplitInbox()
  const { mask } = useHideEmails()
  const { data: accounts, isPending, isError, error, refetch } = useMailAccounts()

  return (
    <SectionCard
      title="Mailboxes"
      toolbar={
        accounts ? (
          <span className="text-ink-3 text-[0.75rem]">{accounts.length} connected</span>
        ) : null
      }
    >
      <QueryState
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={!isPending && (accounts?.length ?? 0) === 0}
        loading={
          <div className="grid gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-md" />
                <div className="grid flex-1 gap-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        }
        empty={
          <p className="text-muted-foreground py-6 text-center text-sm">
            No account is connected yet.{' '}
            <Link to="/account" className="text-foreground underline underline-offset-4">
              Connect one
            </Link>
          </p>
        }
      >
        <div className="-m-4 divide-y">
          {accounts?.map((account) => (
            <Link
              key={account.id}
              to="/mail"
              search={split ? { account: account.id } : {}}
              className={cn(ROW_LINK, 'flex items-center gap-2.5 px-4 py-[0.8125rem]')}
            >
              <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-[0.5rem]">
                <ProviderIcon provider={account.provider} className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1 gap-px">
                <span className="text-ink-strong truncate text-xs leading-4 font-semibold">
                  {mask(account.label)}
                </span>
                <span className="text-ink-3 truncate text-[0.71875rem] leading-[0.875rem]">
                  {mask(account.email)}
                </span>
              </span>
              <span
                className={cn(
                  'rounded-chip h-[1.125rem] min-w-5 shrink-0 px-1.5 text-center text-[0.71875rem] leading-[1.125rem] font-bold tabular-nums',
                  account.unread > 0 ? 'bg-secondary text-muted-foreground' : 'text-ink-3'
                )}
              >
                {account.unread}
              </span>
            </Link>
          ))}

          {/* The design's connect row: the connectors live on the Account page. */}
          <Link
            to="/account"
            className={cn(ROW_LINK, 'flex items-center gap-2.5 px-4 py-[0.8125rem]')}
          >
            <span className="text-muted-foreground border-border grid size-7 shrink-0 place-items-center rounded-[0.5rem] border">
              <Plus className="size-3.5" aria-hidden />
            </span>
            <span className="grid min-w-0 flex-1 gap-px">
              <span className="text-ink-strong truncate text-xs leading-4 font-semibold">
                Connect a mailbox
              </span>
              <span className="text-ink-3 truncate text-[0.71875rem] leading-[0.875rem]">
                Gmail, Outlook, Proton and more
              </span>
            </span>
          </Link>
        </div>
      </QueryState>
    </SectionCard>
  )
}

const SHORTCUTS = [
  { folder: 'inbox', label: 'Open unified inbox', icon: Inbox, digit: '1' },
  { folder: 'spam', label: 'Spam & blocked', icon: ShieldCheck, digit: '3' },
] as const

/** Keyboard routes into the mailbox: ⌘ or Ctrl with the row's digit. */
function Shortcuts() {
  const navigate = useNavigate()

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      const shortcut = SHORTCUTS.find((item) => item.digit === event.key)
      if (!shortcut) return
      event.preventDefault()
      navigate({ to: '/mail', search: { folder: shortcut.folder } })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  return (
    <SectionCard title="Shortcuts">
      <nav aria-label="Shortcuts" className="-m-4 grid">
        {SHORTCUTS.map((item) => (
          <Link
            key={item.folder}
            to="/mail"
            search={{ folder: item.folder }}
            className={cn(ROW_LINK, 'flex items-center gap-[0.6875rem] px-4 py-[0.78125rem]')}
          >
            <span className="bg-muted grid size-[1.625rem] shrink-0 place-items-center rounded-[0.4375rem]">
              <item.icon className="text-muted-foreground size-3.5" aria-hidden />
            </span>
            <span className="text-ink-strong flex-1 text-xs font-medium">{item.label}</span>
            <kbd className="text-ink-3 font-sans text-[0.71875rem] font-semibold">
              {SEARCH_KEYS.replace('K', item.digit)}
            </kbd>
          </Link>
        ))}
      </nav>
    </SectionCard>
  )
}

export const Route = createFileRoute('/(app)/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SettingsPage>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <DashboardToolbar />
        <MailStats />
        {/* minmax(0,1fr) on every level: an implicit grid track grows to fit a row's nowrap text. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
            <RecentMessages />
            <Quarantined />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
            <Mailboxes />
            <Shortcuts />
          </div>
        </div>
      </div>
    </SettingsPage>
  )
}
