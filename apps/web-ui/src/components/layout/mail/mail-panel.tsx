import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
  Archive,
  ArrowUpRight,
  File,
  Inbox,
  OctagonAlert,
  PenLine,
  Send,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Trash2,
} from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import { ProviderIcon } from '@/components/block/account/connector-list'
import ComposeSheet from '@/components/block/mail/compose-sheet'
import TokenUsageCard from '@/components/block/settings/billing/token-usage-card'
import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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
import { COMMUNITY } from '@/lib/constants/edition'
import { cn } from '@/lib/utils'

import { IMPORTANCE_LABELS } from './mail-data'

// The folders the server syncs; IMAP has one junk folder, shown as Spam.
export const MAIL_FOLDERS: { id: Models.MailFolder; title: string; icon: typeof Inbox }[] = [
  { id: 'inbox', title: 'Inbox', icon: Inbox },
  { id: 'drafts', title: 'Drafts', icon: File },
  { id: 'sent', title: 'Sent', icon: Send },
  { id: 'archive', title: 'Archive', icon: Archive },
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
 * Where the AI assistant lives (Control Center > Agent tools > AI Assistant
 * Panel): 'floating' over the mail page's bottom right corner, or 'beside',
 * the default, the pane next to the email.
 */
export function useAgentPanelPosition(): 'beside' | 'floating' {
  const { data } = useQuery(queries.auth.profile())
  return data?.user?.metadata?.agent_panel === 'floating' ? 'floating' : 'beside'
}

/**
 * The account named by ?account=, in either mode, so a link to one mailbox
 * opens it. Without one, Split inbox falls back to the first account and the
 * global inbox shows them all (undefined). Undefined while loading too.
 */
export function useMailAccount() {
  const split = useSplitInbox()
  const { account } = useSearch({ strict: false })
  const { data } = useMailAccounts()
  const named = data?.find((item) => item.id === account)
  if (named) return named
  return split ? data?.[0] : undefined
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
 * An account's hue, from its place among the organization's accounts: the golden
 * ratio keeps them apart however many there are, where a hash of the address could
 * collide. It skips 230-320, the blue of unread mail and the violet of the AI.
 */
const accountHue = (index: number) => (320 + ((index * 0.618034) % 1) * 270) % 360

/** The account a mail belongs to, by address: it tells two mailboxes of one provider apart. */
export function AccountFlag({
  account,
  className,
}: {
  account: Models.EmailAccount
  className?: string
}) {
  const { mask } = useHideEmails()
  const { data: accounts } = useMailAccounts()
  const index = accounts?.findIndex((item) => item.id === account.id) ?? 0

  return (
    <span
      title={mask(account.email)}
      className={cn('chip chip--sm chip--account', className)}
      style={{ '--chip-hue': accountHue(index) } as React.CSSProperties}
    >
      <ProviderIcon provider={account.provider} className="size-3.5 bg-transparent" tint={false} />
      <span className="chip__label">{mask(account.email)}</span>
    </span>
  )
}

/** Second panel of the sidebar-09 shell on /mail: compose, folders and labels. */
/**
 * Phones only: the folder panel is hidden there (the rail lists the folders),
 * so the list gets what else lives in it: the labels as a scrolling row of
 * chips, and Compose as a floating button.
 */
export function MobileMailBar() {
  const { data: accounts } = useMailAccounts()
  const account = useMailAccount()
  const { label } = useSearch({ strict: false })
  const [composing, setComposing] = React.useState(false)

  return (
    <div className="grid gap-2 border-b p-3 md:hidden">
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

/**
 * The design's upgrade banner: shown while the user is on the Free plan. The
 * plan comes from the quota, because a Free user has no subscription at all.
 */
function UpgradeBanner() {
  const { organization } = useActiveOrganization()
  const { data: quota } = useQuery(queries.quota.status())
  const { data: stats } = useQuery({
    ...queries.organizations.stats(organization?.id),
    refetchOnWindowFocus: false,
  })
  const { data: plans } = useQuery(queries.billing.plans())
  // Unlimited means an enterprise tier or a super user: nothing to upgrade to.
  if (quota?.plan !== 'free' || quota.limit_tokens === null) return null
  const plan = plans?.find((item) => item.code === 'free')
  const limit = plan?.max_email_accounts
  const meta = stats
    ? limit
      ? `${stats.accounts} of ${limit} mailboxes`
      : `${stats.accounts} ${stats.accounts === 1 ? 'mailbox' : 'mailboxes'}`
    : ''

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-accent-ink/20 bg-accent-ink/8 p-2.5">
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent-ink/15">
          <Sparkles className="size-[13px] text-accent-soft" />
        </span>
        <span className="grid min-w-0 flex-1 text-left">
          <span className="truncate text-xs leading-4 font-bold">Upgrade your plan</span>
          <span className="text-ink-3 truncate text-[9.5px] leading-[13px]">
            {[plan?.name ?? 'Free', meta].filter(Boolean).join(' · ')}
          </span>
        </span>
      </div>
      <p className="text-muted-foreground text-[10.5px] leading-[15px]">
        Unlimited mailboxes, 100M AI tokens a week and priority sync.
      </p>
      <Button
        asChild
        className="h-7 w-full justify-center gap-1.5 rounded-[7px] bg-accent-ink text-[11.5px] font-bold text-[#0a0a0a] shadow-none hover:bg-accent-ink/90"
      >
        <Link to="/settings/billing">
          <ArrowUpRight className="size-3" />
          Upgrade to Pro
        </Link>
      </Button>
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
  const position = useAgentPanelPosition()
  // The open account's counts, or in the global inbox every account's.
  const counted = account ? [account] : split === false ? (accounts ?? []) : []
  const badge = (id: Models.MailFolder) =>
    counted.reduce(
      (sum, item) => sum + (id === 'inbox' ? item.unread : (item.folder_counts?.[id] ?? 0)),
      0
    )

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-0">
        <OrganizationSwitcher />
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
              <SidebarMenuItem className="mb-2 flex gap-2">
                <Button
                  className="h-8 flex-1 justify-center gap-[7px] rounded-[8px] bg-accent-ink text-xs font-semibold text-[#0a0a0a] hover:bg-accent-ink/90"
                  onClick={() => setComposing(true)}
                  disabled={!accounts?.length}
                >
                  <PenLine className="size-[13px]" />
                  Compose
                </Button>
                {/* Floating mode has its own button in the page's corner. */}
                {position !== 'floating' && (
                  <Button
                    variant={agent ? 'secondary' : 'outline'}
                    size="icon"
                    className="size-8 rounded-[8px]"
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
                )}
              </SidebarMenuItem>
              {MAIL_FOLDERS.map((item) => {
                const count = badge(item.id)
                return (
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
                    {count > 0 && (
                      <SidebarMenuBadge
                        className={cn(
                          'right-2 rounded-[4px] px-[5px] text-[9.5px]',
                          item.id === 'inbox'
                            ? 'bg-accent-ink/20 text-accent-soft peer-data-active/menu-button:text-accent-soft'
                            : 'bg-muted text-ink-3'
                        )}
                      >
                        {count > 99 ? '99+' : count}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Labels</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIL_LABELS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  {/* The dot's column lines its text up with the folder names above. */}
                  <SidebarMenuButton
                    asChild
                    isActive={label === item.id}
                    className="gap-[11.5px] pl-[11.5px] text-[11.5px] font-normal"
                  >
                    <Link
                      to="/mail"
                      search={(prev) => ({
                        ...prev,
                        label: prev.label === item.id ? undefined : item.id,
                        mail: undefined,
                      })}
                    >
                      <span className={`${item.color} size-1.5 shrink-0 rounded-full`} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* The design pins the Free-plan banner to the bottom of the panel body. */}
        {!COMMUNITY && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <UpgradeBanner />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      {!COMMUNITY && (
        <SidebarFooter className="gap-2 border-t p-2.5">
          <TokenUsageCard />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/settings">
                  <SlidersHorizontal />
                  <span>Control Center</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
