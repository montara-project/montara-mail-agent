import { Link, useLocation } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import { useTheme } from 'next-themes'
import React from 'react'

import type { Models } from '@/lib/api/models'
import type { UserInfo } from '@/types/menu'

import { AnimatedThemeToggler } from '#/components/ui/animated-theme-toggler'
import MailPanel, { MAIL_FOLDERS, useMailFolder } from '@/components/layout/mail/mail-panel'
import AccountsPanel from '@/components/layout/platform/accounts-panel'
import DashboardPanel from '@/components/layout/platform/dashboard-panel'
import SettingsPanel from '@/components/layout/settings/settings-panel'
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
  useSidebar,
} from '@/components/ui/sidebar'
import { NAV_ITEMS } from '@/data/sidebar-menu'
import { COMMUNITY } from '@/lib/constants/edition'

import NavUser from './nav-user'

/** Light/dark switch with Magic UI's circular reveal; next-themes keeps the choice. */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <AnimatedThemeToggler
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      onThemeChange={setTheme}
      title="Toggle theme"
      className="self-center hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring flex size-[34px] items-center justify-center rounded-[8px] outline-none focus-visible:ring-2 [&_svg]:size-4"
    />
  )
}

/** The second panel shown next to the rail for a path, if any. */
function sidebarPanel(pathname: string) {
  if (pathname.startsWith('/mail')) return <MailPanel />
  if (pathname.startsWith('/dashboard')) return <DashboardPanel />
  if (pathname.startsWith('/account')) return <AccountsPanel />
  if (pathname.startsWith('/settings')) return <SettingsPanel />
  return null
}

/** Whether a path has a second panel, which sets the sidebar width. */
export function hasSidebarPanel(pathname: string) {
  return sidebarPanel(pathname) !== null
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  /** The signed-in user from GET /v1/auth/me; undefined while it loads. */
  user?: Models.User | null
  /** True when the profile request failed and no data is available. */
  userError?: boolean
  /** Refetches the profile request, wired to the error state's retry. */
  onRetryUser?: () => void
}

/**
 * shadcn sidebar-09: an icon rail on every page, plus a second panel next to
 * it on the pages that have one (see sidebarPanel).
 */
export default function AppSidebar({ user, userError, onRetryUser, ...props }: AppSidebarProps) {
  const pathname = useLocation().pathname
  const isMail = pathname.startsWith('/mail')
  const activeFolder = useMailFolder()
  const { setOpen } = useSidebar()

  const userInfo: UserInfo | undefined = user
    ? {
        name: user.name,
        email: user.email,
        avatar: user.image ?? '',
      }
    : undefined

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* Icon rail: not collapsible, fixed to the icon width. */}
      <Sidebar collapsible="none" className="w-[52px]! shrink-0 border-r">
        {/* Each rail button sets its own centered size from md up, and the menu button
        no longer resizes in the collapsed state, so nothing moves when the sidebar toggles. */}
        <SidebarHeader className="p-2.5 pb-0 md:items-center">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:mx-auto md:size-[30px] md:p-0">
                <Link to="/dashboard">
                  <span
                    aria-hidden
                    className="grid size-[30px] shrink-0 place-items-center rounded-[8px] bg-accent-ink/15 ring-1 ring-accent-ink/25"
                  >
                    <Mail className="size-[15px] text-accent-soft" />
                  </span>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Montara</span>
                    <span className="truncate text-xs">{COMMUNITY ? 'Community' : 'Mail'}</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className="gap-1 p-0 pt-1.5">
          <SidebarGroup className="p-0">
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu className="md:gap-1.5">
                {NAV_ITEMS.map((item) => {
                  const className = `rounded-[8px] px-2.5 md:mx-auto md:size-8.5 md:rounded-[8px] md:p-2.25 [&_svg]:size-4`
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        asChild
                        tooltip={{ children: item.title, hidden: false }}
                        isActive={pathname.startsWith(item.url)}
                        className={className}
                      >
                        <Link to={item.url}>
                          {item.icon && <item.icon />}
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {/* Phones only: there the folder panel is hidden, so the rail lists the folders. */}
          <SidebarGroup className="md:hidden">
            <SidebarGroupLabel>Mail</SidebarGroupLabel>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {MAIL_FOLDERS.map((folder) => (
                  <SidebarMenuItem key={folder.id}>
                    <SidebarMenuButton
                      asChild
                      tooltip={{ children: folder.title, hidden: false }}
                      isActive={isMail && activeFolder.id === folder.id}
                      className="px-2.5 md:px-2"
                    >
                      <Link
                        to="/mail"
                        search={(prev) => ({ account: prev.account, folder: folder.id })}
                        onClick={() => setOpen(true)}
                      >
                        <folder.icon />
                        <span>{folder.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="gap-3 p-2.5">
          <ThemeToggle />
          <NavUser user={userInfo} userError={userError} onRetryUser={onRetryUser} />
        </SidebarFooter>
      </Sidebar>

      {/* The second panel is hidden, not clipped, once the rail collapses: while
      it stays laid out it keeps its min-content width and squeezes the rail.*/}
      <div className="contents group-data-[collapsible=icon]:hidden">{sidebarPanel(pathname)}</div>
    </Sidebar>
  )
}
