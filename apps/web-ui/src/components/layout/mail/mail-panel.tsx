import { useQuery } from '@tanstack/react-query'
import { Link, useSearch, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  Check,
  ChevronsUpDown,
  File,
  Inbox,
  OctagonAlert,
  Plus,
  Send,
  SquarePen,
  Trash2,
  Sparkles,
} from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import { ProviderIcon } from '@/components/block/account/connector-list'
import ComposeSheet from '@/components/block/mail/compose-sheet'
import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

import { IMPORTANCE_LABELS } from './mail-data'

// The folders the server syncs; IMAP has one junk folder, shown as Spam.
export const MAIL_FOLDERS: { id: Models.MailFolder; title: string; icon: typeof Inbox }[] = [
  { id: 'inbox', title: 'Inbox', icon: Inbox },
  { id: 'archive', title: 'Archive', icon: Archive },
  { id: 'drafts', title: 'Drafts', icon: File },
  { id: 'sent', title: 'Sent', icon: Send },
  { id: 'spam', title: 'Spam', icon: OctagonAlert },
  { id: 'trash', title: 'Trash', icon: Trash2 },
]

/**
 * Labels filter the list by the importance the AI or the user gave a mail.
 * Each has its own hue (tokens in styles.css), so violet stays the AI's color:
 * `color` is the dot, `tone` a tinted chip in the label's hue.
 */
export const MAIL_LABELS: {
  id: Models.MailImportance
  title: string
  color: string
  tone: string
}[] = [
  {
    id: 'important',
    title: IMPORTANCE_LABELS.important,
    color: 'bg-label-important',
    tone: 'border-label-important/30 bg-label-important/10 text-label-important',
  },
  {
    id: 'low_priority',
    title: IMPORTANCE_LABELS.low_priority,
    color: 'bg-label-low-priority',
    tone: 'border-label-low-priority/30 bg-label-low-priority/10 text-label-low-priority',
  },
  {
    id: 'broadcast',
    title: IMPORTANCE_LABELS.broadcast,
    color: 'bg-label-broadcast',
    tone: 'border-label-broadcast/30 bg-label-broadcast/10 text-label-broadcast',
  },
]

/** The folder named by ?folder=, falling back to the inbox. */
export function useMailFolder() {
  const { folder } = useSearch({ strict: false })
  return MAIL_FOLDERS.find((item) => item.id === folder) ?? MAIL_FOLDERS[0]
}

/** The active organization's email accounts. */
export function useMailAccounts() {
  const { organization } = useActiveOrganization()
  return useQuery(queries.emailAccounts.list(organization?.id))
}

/**
 * Whether the user turned on Split inbox (Control Center > Mail), which shows
 * one account at a time instead of the global inbox. Undefined until known.
 */
export function useSplitInbox() {
  const { data, isPending } = useQuery(queries.auth.profile())
  return isPending ? undefined : data?.user?.metadata?.split_inbox === true
}

/**
 * With Split inbox on, the account named by ?account=, falling back to the
 * first one. Undefined in the global inbox, while loading, or when none is connected.
 */
export function useMailAccount() {
  const split = useSplitInbox()
  const { account } = useSearch({ strict: false })
  const { data } = useMailAccounts()
  if (!split) return undefined
  return data?.find((item) => item.id === account) ?? data?.[0]
}

/**
 * Finds the account to flag on a mail: only in the global inbox, and only with
 * more than one account, where it tells the mails apart.
 */
export function useFlaggedAccount() {
  const split = useSplitInbox()
  const { data } = useMailAccounts()
  const flagged = split === false && (data?.length ?? 0) > 1
  return (mail: Models.Mail) =>
    flagged ? data?.find((item) => item.id === mail.email_account_id) : undefined
}

/**
 * The account a mail belongs to. The label tells two mailboxes of one provider
 * apart, so it stays text; it is the address itself unless renamed, hence the mask.
 */
export function AccountFlag({
  account,
  className,
}: {
  account: Models.EmailAccount
  className?: string
}) {
  const { mask } = useHideEmails()

  return (
    <span
      title={mask(account.email)}
      className={cn('text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs', className)}
    >
      <ProviderIcon provider={account.provider} className="size-4 rounded-sm" />
      <span className="truncate">{mask(account.label)}</span>
    </span>
  )
}

/** Shows the open account and switches to another one; the global inbox has none to switch. */
function AccountSwitcher() {
  const { data: accounts, isPending } = useMailAccounts()
  const split = useSplitInbox()
  const account = useMailAccount()
  const { mask } = useHideEmails()
  const loading = isPending || split === undefined

  if (split === false && accounts?.length) {
    const only = accounts.length === 1 ? accounts[0] : undefined
    return (
      <Link
        to="/account"
        title="Manage email accounts"
        className="hover:bg-sidebar-accent focus-visible:ring-ring/50 flex w-full items-center gap-2.5 rounded-lg border p-2 text-left text-sm outline-none focus-visible:ring-[3px]"
      >
        {/* Overlapping only the icons' padding, so no logo is cut. */}
        <span className="flex shrink-0 -space-x-1.5">
          {accounts.slice(0, 3).map((item) => (
            <ProviderIcon
              key={item.id}
              provider={item.provider}
              className="ring-sidebar size-7 rounded-md ring-2"
            />
          ))}
        </span>
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="truncate font-medium">{only ? mask(only.label) : 'All accounts'}</span>
          <span className="text-muted-foreground truncate text-xs">
            {only ? mask(only.email) : `${accounts.length} connected`}
          </span>
        </span>
      </Link>
    )
  }

  if (!account) {
    return (
      <Button variant="outline" className="w-full" asChild={!loading} disabled={loading}>
        {loading ? (
          <span>Loading accounts...</span>
        ) : (
          <Link to="/account">
            <Plus />
            Connect an email account
          </Link>
        )}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch email account"
          className="hover:bg-sidebar-accent focus-visible:ring-ring/50 flex w-full items-center gap-2.5 rounded-lg border p-2 text-left text-sm outline-none focus-visible:ring-[3px]"
        >
          <ProviderIcon provider={account.provider} className="size-8 rounded-md" />
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate font-medium">{mask(account.label)}</span>
            <span className="text-muted-foreground truncate text-xs">{mask(account.email)}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Email accounts
        </DropdownMenuLabel>
        {accounts?.map((item) => (
          <DropdownMenuItem key={item.id} asChild>
            <Link to="/mail" search={{ account: item.id }}>
              <ProviderIcon provider={item.provider} className="size-7 shrink-0 rounded-md" />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate">{mask(item.label)}</span>
                <span className="text-muted-foreground truncate text-xs">{mask(item.email)}</span>
              </span>
              {item.unread > 0 && (
                <Badge size="sm" aria-label={`${item.unread} unread`}>
                  {item.unread}
                </Badge>
              )}
              {item.id === account.id && <Check />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <Plus />
            Connect an account
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Second panel of the sidebar-09 shell on /mail: compose, folders and labels. */
/**
 * Phones only: the folder panel is hidden there (the rail lists the folders),
 * so the list gets what else lives in it: the account switcher, the labels as
 * a scrolling row of chips, and Compose as a floating button.
 */
export function MobileMailBar() {
  const { data: accounts } = useMailAccounts()
  const account = useMailAccount()
  const { label } = useSearch({ strict: false })
  const [composing, setComposing] = React.useState(false)

  return (
    <div className="grid gap-2 border-b p-3 md:hidden">
      <AccountSwitcher />
      <nav aria-label="Labels" className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
        {MAIL_LABELS.map((item) => {
          const active = label === item.id
          return (
            <Link
              key={item.id}
              to="/mail"
              search={(prev) => ({
                ...prev,
                label: active ? undefined : item.id,
                mail: undefined,
                page: undefined,
              })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm',
                active ? item.tone : 'text-muted-foreground'
              )}
            >
              <span className={`${item.color} size-2.5 shrink-0 rounded-sm`} />
              {item.title}
            </Link>
          )
        })}
      </nav>
      {!!accounts?.length && (
        <Button
          className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 size-14 rounded-full shadow-lg"
          aria-label="Compose"
          onClick={() => setComposing(true)}
        >
          <SquarePen className="size-5" />
        </Button>
      )}
      <ComposeSheet
        open={composing}
        onOpenChange={setComposing}
        accounts={accounts}
        defaultAccountId={account?.id ?? accounts?.[0]?.id}
      />
    </div>
  )
}

export default function MailPanel() {
  const folder = useMailFolder()
  const account = useMailAccount()
  const { label } = useSearch({ strict: false })
  const { data: accounts } = useMailAccounts()
  const split = useSplitInbox()
  const [composing, setComposing] = React.useState(false)
  const navigate = useNavigate()
  const { agent } = useSearch({ strict: false })
  // The open account's counts, or in the global inbox every account's.
  const counted = split === false ? (accounts ?? []) : account ? [account] : []
  const badges: Partial<Record<Models.MailFolder, number>> = {
    inbox: counted.reduce((sum, item) => sum + item.unread, 0),
    spam: counted.reduce((sum, item) => sum + item.spam, 0),
  }

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-2">
        <OrganizationSwitcher />
        <AccountSwitcher />
        <div className="flex w-full gap-2">
          <Button
            className="flex-1"
            onClick={() => setComposing(true)}
            disabled={!accounts?.length}
          >
            <SquarePen />
            Compose
          </Button>
          <Button
            variant={agent ? 'secondary' : 'outline'}
            aria-label="Toggle AI assistant"
            title="AI assistant"
            onClick={() =>
              navigate({
                to: '/mail',
                search: (prev: Record<string, unknown>) => ({ ...prev, agent: !agent }),
              })
            }
          >
            <Sparkles />
          </Button>
        </div>
        <ComposeSheet
          open={composing}
          onOpenChange={setComposing}
          accounts={accounts}
          defaultAccountId={account?.id ?? accounts?.[0]?.id}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIL_FOLDERS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton asChild isActive={folder.id === item.id}>
                    <Link
                      to="/mail"
                      search={(prev) => ({ account: prev.account, folder: item.id })}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {!!badges[item.id] && <SidebarMenuBadge>{badges[item.id]}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Labels</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIL_LABELS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton asChild isActive={label === item.id}>
                    <Link
                      to="/mail"
                      search={(prev) => ({
                        ...prev,
                        label: prev.label === item.id ? undefined : item.id,
                        mail: undefined,
                      })}
                    >
                      <span className={`${item.color} size-2.5 shrink-0 rounded-sm`} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
