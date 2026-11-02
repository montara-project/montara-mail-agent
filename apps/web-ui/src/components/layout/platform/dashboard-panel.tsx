import { Link, useLocation } from '@tanstack/react-router'
import {
  ArrowLeft,
  Inbox,
  LayoutDashboard,
  Settings,
  Sparkles,
  ShieldAlert,
  UserRound,
} from 'lucide-react'

import TokenUsageCard from '@/components/block/settings/billing/token-usage-card'
import { useMailAccounts } from '@/components/layout/mail/mail-panel'
import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { COMMUNITY } from '@/lib/constants/edition'

const WORKSPACE_ITEMS = [
  { title: 'Dashboard', icon: LayoutDashboard, url: '/dashboard' },
  { title: 'Account', icon: UserRound, url: '/account' },
  { title: 'Control Center', icon: Settings, url: '/settings' },
]

const SHORTCUT_ITEMS = [
  { title: 'Unified inbox', icon: Inbox, folder: 'inbox' },
  { title: 'Spam & blocked', icon: ShieldAlert, folder: 'spam' },
] as const

/** Second panel of the sidebar-09 shell on the Dashboard and Account pages. */
export default function DashboardPanel() {
  const pathname = useLocation().pathname
  // The org-wide counts the shortcut rows carry, same source as the Mail panel.
  const { data: accounts } = useMailAccounts()
  const counts = {
    inbox: (accounts ?? []).reduce((sum, item) => sum + item.unread, 0),
    spam: (accounts ?? []).reduce((sum, item) => sum + item.spam, 0),
  }

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-0">
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORKSPACE_ITEMS.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Shortcuts</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {SHORTCUT_ITEMS.map((item) => (
                <SidebarMenuItem key={item.folder}>
                  <SidebarMenuButton asChild>
                    <Link to="/mail" search={{ folder: item.folder }}>
                      <item.icon />
                      <span>{item.title}</span>
                      {counts[item.folder] > 0 && (
                        <span className="bg-muted ml-auto rounded-[4px] px-[5px] py-px font-mono text-[9.5px] font-semibold text-ink-3 tabular-nums">
                          {counts[item.folder] > 99 ? '99+' : counts[item.folder]}
                        </span>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* The plain nav row back to Mail, pinned to the bottom of the body. */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/mail">
                    <ArrowLeft />
                    <span>Open Mail</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {!COMMUNITY && (
        <SidebarFooter className="gap-1 p-4">
          <TokenUsageCard />
          <Link
            to="/settings/billing"
            className="hover:bg-accent flex items-center gap-[7px] rounded-lg border border-border bg-secondary px-2.5 py-2 text-[11.5px] font-semibold outline-none"
          >
            <Sparkles className="text-accent-ink size-3 shrink-0" aria-hidden />
            Upgrade to Pro
          </Link>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
