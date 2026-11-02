import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronRight,
  Inbox,
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
import PageContainer from '@/components/block/common/page-container'
import QueryState from '@/components/block/common/query-state'
import SectionCard from '@/components/block/common/section-card'
import MailStats from '@/components/block/dashboard/mail-stats'
import ComposeSheet from '@/components/block/mail/compose-sheet'
import { formatMailListDate, senderName } from '@/components/layout/mail/mail-data'
import { useMailAccounts, useSplitInbox } from '@/components/layout/mail/mail-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, InputWrapper } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { queries } from '@/lib/api/queries'

/** Rows shown per card; the cards link to Mail for the rest. */
const RECENT_LIMIT = 5
const QUARANTINE_LIMIT = 3

// The search shortcut as the mail list writes it; Ctrl K works everywhere but a Mac.
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

const SEARCH_KEYS =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'

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
        <InputWrapper className="rounded-lg bg-card border-border">
          <Search />
          <Input
            ref={searchRef}
            placeholder="Search messages, senders or attachments"
            aria-label="Search mail"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
          <kbd className="bg-secondary rounded-tag px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
            {SEARCH_KEYS}
          </kbd>
        </InputWrapper>
      </form>
      {/* The folder and label filters live on the mail page. */}
      <Button asChild variant="ghost" className="text-muted-foreground">
        <Link to="/mail">
          <SlidersHorizontal />
          Filter
        </Link>
      </Button>
      <Button onClick={() => setComposing(true)} disabled={!accounts?.length}>
        <SquarePen />
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
      className="hover:bg-accent/50 focus-visible:ring-ring/50 -mx-4 flex items-start gap-3 rounded-md px-4 py-[11px] outline-none focus-visible:ring-[3px]"
    >
      <span
        className="mt-0.5 flex size-[34px] shrink-0 items-center justify-center rounded-full border text-[12.5px] font-bold uppercase"
        style={{
          backgroundColor: `${color}1f`,
          borderColor: `${color}33`,
          color,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
        <span className="flex items-baseline gap-1.5">
          <span className="max-w-[60%] shrink-0 truncate text-sm font-medium">{mask(name)}</span>
          {mail.subject && (
            <span className="text-muted-foreground min-w-0 truncate text-sm">· {mail.subject}</span>
          )}
        </span>
        {mail.teaser && <span className="text-ink-3 truncate text-[11.5px]">{mail.teaser}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <span className="text-muted-foreground text-[11px] font-medium tabular-nums">
          {formatMailListDate(mail.received_at)}
        </span>
        {!mail.is_read && (
          <>
            <span aria-hidden className="size-1.5 rounded-full bg-foreground" />
            <span className="sr-only">Unread</span>
          </>
        )}
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
      toolbar={
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Badge variant="secondary" size="sm">
              {unread} new
            </Badge>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to="/mail">
              View all
              <ArrowRight />
            </Link>
          </Button>
        </div>
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
        <div className="divide-y">
          {mails.map((mail) => (
            <MessageRow key={mail.id} mail={mail} />
          ))}
        </div>
      </QueryState>
    </SectionCard>
  )
}

/**
 * Mail the server held in spam. There is no restore action or per-mail reason
 * on the API, so a row shows what the mail is (its teaser) and links to the
 * spam folder, where "not spam" lives.
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
      toolbar={
        <div className="flex items-center gap-2">
          {total > 0 && (
            <Badge variant="secondary" size="sm">
              {total}
            </Badge>
          )}
          <Button asChild variant="ghost" size="sm">
            <Link to="/mail" search={{ folder: 'spam' }}>
              Review all
              <ChevronRight />
            </Link>
          </Button>
        </div>
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
        <div className="divide-y">
          {mails.map((mail) => (
            <div
              key={mail.id}
              className="-mx-4 flex items-start gap-3 border-t border-border px-4 py-[9px] first:border-t-0"
            >
              <span className="bg-warning/10 text-warning mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-[7px]">
                <ShieldX className="size-3" aria-hidden />
              </span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-xs font-semibold text-ink-strong">
                  {mask(mail.from_email || senderName(mail))}
                </span>
                <span className="text-ink-3 truncate text-[11.5px]">
                  {mail.subject || '(no subject)'}
                </span>
                {mail.teaser && <span className="text-ink-3 truncate text-xs">{mail.teaser}</span>}
              </div>
            </div>
          ))}
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
          <span className="text-muted-foreground text-xs">{accounts.length} connected</span>
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
        <div className="divide-y">
          {accounts?.map((account) => (
            <Link
              key={account.id}
              to="/mail"
              search={split ? { account: account.id } : {}}
              className="hover:bg-accent/50 focus-visible:ring-ring/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 outline-none focus-visible:ring-[3px]"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-muted">
                <ProviderIcon provider={account.provider} className="size-4" />
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="truncate text-xs font-semibold text-ink-strong">
                  {mask(account.label)}
                </span>
                <span className="text-ink-3 truncate text-[10.5px]">{mask(account.email)}</span>
              </span>
              {account.unread > 0 && (
                <span className="bg-secondary h-[18px] shrink-0 rounded-chip px-1.5 text-[10.5px] font-bold text-muted-foreground leading-[18px] tabular-nums">
                  {account.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      </QueryState>
    </SectionCard>
  )
}

/** Keyboard routes into the mailbox; the hints render in the mono font. */
function Shortcuts() {
  return (
    <SectionCard title="Shortcuts">
      <nav aria-label="Shortcuts" className="grid">
        <Link
          to="/mail"
          search={{ folder: 'inbox' }}
          className="hover:bg-accent/50 focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-[8px] bg-muted px-2 py-[7px] text-xs font-medium text-ink-strong outline-none focus-visible:ring-[3px]"
        >
          <Inbox className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span className="flex-1">Open unified inbox</span>
          <kbd className="text-[10.5px] font-semibold text-ink-3">⌘1</kbd>
        </Link>
        <Link
          to="/mail"
          search={{ folder: 'spam' }}
          className="hover:bg-accent/50 focus-visible:ring-ring/50 flex items-center gap-2.5 rounded-[8px] bg-muted px-2 py-[7px] text-xs font-medium text-ink-strong outline-none focus-visible:ring-[3px]"
        >
          <ShieldCheck className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span className="flex-1">Spam &amp; blocked</span>
          <kbd className="text-[10.5px] font-semibold text-ink-3">⌘3</kbd>
        </Link>
      </nav>
    </SectionCard>
  )
}

export const Route = createFileRoute('/(app)/dashboard/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <PageContainer className="gap-3">
      <DashboardToolbar />
      <MailStats />
      {/* minmax(0,1fr) on every level: an implicit grid track grows to fit a row's nowrap text. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
          <RecentMessages />
          <Quarantined />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
          <Mailboxes />
          <Shortcuts />
        </div>
      </div>
    </PageContainer>
  )
}
