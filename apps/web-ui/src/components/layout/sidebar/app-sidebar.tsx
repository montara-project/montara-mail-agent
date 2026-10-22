import { IconBox } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import React from 'react'

import type { Models } from '@/lib/api/models'
import type { UserInfo } from '@/types/menu'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { getSidebarMenu } from '@/data/sidebar-menu'

import NavMain from './nav-main'
import NavUser from './nav-user'

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  /** The signed-in user from GET /v1/auth/me; undefined while it loads. */
  user?: Models.User | null
  /** True when the profile request failed and no data is available. */
  userError?: boolean
  /** Refetches the profile request, wired to the error state's retry. */
  onRetryUser?: () => void
}

export default function AppSidebar({ user, userError, onRetryUser, ...props }: AppSidebarProps) {
  const userInfo: UserInfo | undefined = user
    ? {
        name: user.fullname,
        email: user.email,
        avatar: '',
      }
    : undefined

  const menu = getSidebarMenu(user?.role?.name)

  return (
    <Sidebar collapsible="icon" variant="floating" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <IconBox className="size-5" />
                </div>
                <div className="flex flex-col gap-1 leading-none">
                  <span className="font-medium">Vine</span>
                  <span className="text-xs">Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain title="Menu" items={menu.navMenu.overview} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userInfo} userError={userError} onRetryUser={onRetryUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
