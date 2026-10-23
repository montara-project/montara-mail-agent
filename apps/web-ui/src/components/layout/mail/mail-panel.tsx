import { useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import {
  Check,
  ChevronsUpDown,
  File,
  Inbox,
  OctagonAlert,
  Plus,
  Send,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { ProviderIcon } from '@/components/block/account/connector-list'
import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
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
import { queries } from '@/lib/api/queries'

import { IMPORTANCE_LABELS } from './mail-data'

// The folders the server syncs; IMAP has one junk folder, shown as Spam.
export const MAIL_FOLDERS: { id: Models.MailFolder; title: string; icon: typeof Inbox }[] = [
  { id: 'inbox', title: 'Inbox', icon: Inbox },
  { id: 'drafts', title: 'Drafts', icon: File },
  { id: 'sent', title: 'Sent', icon: Send },
  { id: 'spam', title: 'Spam', icon: OctagonAlert },
  { id: 'trash', title: 'Trash', icon: Trash2 },
]

/** Labels filter the list by the importance the AI or the user gave a mail. */
export const MAIL_LABELS: { id: Models.MailImportance; title: string; color: string }[] = [
  { id: 'important', title: IMPORTANCE_LABELS.important, color: 'bg-violet-500' },
  { id: 'low_priority', title: IMPORTANCE_LABELS.low_priority, color: 'bg-emerald-500' },
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

/** The account named by ?account=, falling back to the first one; undefined while loading or when none is connected. */
export function useMailAccount() {
  const { account } = useSearch({ strict: false })
  const { data } = useMailAccounts()
  return data?.find((item) => item.id === account) ?? data?.[0]
}

/** Shows the open account and switches to another one. */
function AccountSwitcher() {
  const { data: accounts, isPending } = useMailAccounts()
  const account = useMailAccount()

  if (!account) {
    return (
      <Button variant="outline" className="w-full" asChild={!isPending} disabled={isPending}>
        {isPending ? (
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
            <span className="truncate font-medium">{account.label}</span>
            <span className="text-muted-foreground truncate text-xs">{account.email}</span>
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
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate">{item.label}</span>
                <span className="text-muted-foreground truncate text-xs">{item.email}</span>
              </span>
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
export default function MailPanel() {
  const folder = useMailFolder()
  const account = useMailAccount()
  const { label } = useSearch({ strict: false })
  const badges: Partial<Record<Models.MailFolder, number>> = {
    inbox: account?.unread,
    spam: account?.spam,
  }

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-2">
        <OrganizationSwitcher />
        <AccountSwitcher />
        {/* ponytail: no send endpoint yet; open a compose view once it exists. */}
        <Button
          className="w-full"
          onClick={() => toast.info('Composing mail is not available yet')}
        >
          <SquarePen />
          Compose
        </Button>
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
