import { Link, useLocation } from '@tanstack/react-router'
import { Bot, HardDrive, LayoutDashboard, Settings, UserRound, Wand2 } from 'lucide-react'

import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const PLATFORM_ITEMS = [
  { title: 'Dashboard', icon: LayoutDashboard, url: '/dashboard' },
  { title: 'Account', icon: UserRound, url: '/account' },
  { title: 'Agent Bots', icon: Bot, url: '/agent-bots' },
  { title: 'Skills', icon: Wand2, url: '/skills' },
  { title: 'Settings', icon: Settings, url: '/settings' },
]

const STORAGE_LIMIT_GB = 5
// ponytail: sample usage until the server reports it; swap for a query then.
const STORAGE_USED_GB = 2.4

/** Second panel of the sidebar-09 shell on the Platform pages. */
export default function PlatformPanel() {
  const pathname = useLocation().pathname
  const usedPercent = Math.min(100, (STORAGE_USED_GB / STORAGE_LIMIT_GB) * 100)

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-2">
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {PLATFORM_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
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
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="grid gap-2 rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <HardDrive className="size-4" />
            Storage
          </div>
          <div
            role="progressbar"
            aria-label="Storage used"
            aria-valuemin={0}
            aria-valuemax={STORAGE_LIMIT_GB}
            aria-valuenow={STORAGE_USED_GB}
            aria-valuetext={`${STORAGE_USED_GB} GB of ${STORAGE_LIMIT_GB} GB`}
            className="bg-muted h-2 overflow-hidden rounded-full"
          >
            <div
              className={usedPercent >= 90 ? 'bg-destructive h-full' : 'bg-primary h-full'}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
          <p className="text-muted-foreground text-xs">
            {STORAGE_USED_GB} GB of {STORAGE_LIMIT_GB} GB used
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
