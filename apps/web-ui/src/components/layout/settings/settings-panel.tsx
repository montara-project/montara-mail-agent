import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { ArrowLeft, Settings } from 'lucide-react'

import TokenUsageCard from '@/components/block/settings/billing/token-usage-card'
import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import { Badge } from '@/components/ui/badge'
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
import { DANGER_GROUP, PLATFORM_GROUP, SETTINGS_GROUPS } from '@/data/settings-menu'
import { queries } from '@/lib/api/queries'
import { COMMUNITY } from '@/lib/constants/edition'
import { cn } from '@/lib/utils'

/** Second panel of the sidebar-09 shell on the Control Center pages. */
export default function SettingsPanel() {
  const pathname = useLocation().pathname
  const { data: security } = useQuery(queries.profile.security())
  const groups = [
    ...SETTINGS_GROUPS,
    ...(security?.super_user ? [PLATFORM_GROUP] : []),
    DANGER_GROUP,
  ]

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-0">
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/mail">
                    <ArrowLeft />
                    <span>Back to Mail</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {groups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="mb-1 tracking-[1px]">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {item.url ? (
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(item.url)}
                        className={cn(
                          group === DANGER_GROUP && 'text-danger-soft hover:text-danger-soft'
                        )}
                      >
                        <Link to={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                          {item.soon && (
                            <Badge
                              variant="secondary"
                              appearance="light"
                              size="sm"
                              className="ms-auto shrink-0"
                            >
                              Soon
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      // Not built yet: it names the page and shows as Soon.
                      <SidebarMenuButton aria-disabled className="text-muted-foreground">
                        <item.icon />
                        <span>{item.title}</span>
                        <Badge
                          variant="secondary"
                          appearance="light"
                          size="sm"
                          className="ms-auto shrink-0"
                        >
                          Soon
                        </Badge>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2 p-2.5">
        {!COMMUNITY && <TokenUsageCard />}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/settings'}>
              <Link to="/settings">
                <Settings />
                <span>Control Center</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
