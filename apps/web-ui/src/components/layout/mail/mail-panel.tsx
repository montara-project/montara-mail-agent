import { Link, useSearch } from '@tanstack/react-router'
import { ArchiveX, Check, ChevronsUpDown, File, Inbox, OctagonAlert, Send, SquarePen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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

import { MAIL_ACCOUNTS, mailInitials, MAILS, type MailTab } from './mail-data'

export const MAIL_FOLDERS = [
  { id: 'inbox', title: 'Inbox', icon: Inbox },
  { id: 'drafts', title: 'Drafts', icon: File },
  { id: 'sent', title: 'Sent', icon: Send },
  { id: 'junk', title: 'Junk', icon: ArchiveX },
  { id: 'spam', title: 'Spam', icon: OctagonAlert },
  { id: 'trash', title: 'Trash', icon: Trash2 },
]

export const MAIL_LABELS: { id: MailTab; title: string; color: string }[] = [
  { id: 'focused', title: 'Focused', color: 'bg-violet-500' },
  { id: 'archive', title: 'Archive', color: 'bg-amber-500' },
  { id: 'others', title: 'Others', color: 'bg-emerald-500' },
]

/** The folder named by ?folder=, falling back to the inbox. */
export function useMailFolder() {
  const { folder } = useSearch({ strict: false })
  return MAIL_FOLDERS.find((item) => item.id === folder) ?? MAIL_FOLDERS[0]
}

/** The account named by ?account=, falling back to the first one. */
export function useMailAccount() {
  const { account } = useSearch({ strict: false })
  return MAIL_ACCOUNTS.find((item) => item.id === account) ?? MAIL_ACCOUNTS[0]
}

/** Shows the open account and switches to another one. */
function AccountSwitcher() {
  const account = useMailAccount()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch email account"
          className="hover:bg-sidebar-accent focus-visible:ring-ring/50 flex w-full items-center gap-2.5 rounded-lg border p-2 text-left text-sm outline-none focus-visible:ring-[3px]"
        >
          <Avatar className="size-8 rounded-md">
            <AvatarFallback className="rounded-md">{mailInitials(account.label)}</AvatarFallback>
          </Avatar>
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate font-medium">{account.label}</span>
            <span className="text-muted-foreground truncate text-xs">{account.email}</span>
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuLabel className="text-muted-foreground text-xs">Email accounts</DropdownMenuLabel>
        {MAIL_ACCOUNTS.map((item) => (
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Second panel of the sidebar-09 shell on /mail: compose, folders and labels. */
export default function MailPanel() {
  const folder = useMailFolder()
  const { label } = useSearch({ strict: false })
  const unreadCount = MAILS.filter((mail) => !mail.read).length

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-2">
        <OrganizationSwitcher />
        <AccountSwitcher />
        {/* ponytail: no send endpoint yet; open a compose view once it exists. */}
        <Button className="w-full" onClick={() => toast.info('Composing mail is not available yet')}>
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
                    <Link to="/mail" search={(prev) => ({ account: prev.account, folder: item.id })}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {/* ponytail: sample mails are all in the inbox; count per folder once mail has one. */}
                  {item.id === 'inbox' && unreadCount > 0 && (
                    <SidebarMenuBadge>{unreadCount}</SidebarMenuBadge>
                  )}
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
                  <SidebarMenuBadge>{MAILS.filter((mail) => mail.tab === item.id).length}</SidebarMenuBadge>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
