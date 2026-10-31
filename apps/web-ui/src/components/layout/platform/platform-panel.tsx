import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { LayoutDashboard, Settings, Sparkles, UserRound } from 'lucide-react'

import UsageBar from '@/components/block/settings/billing/usage-bar'
import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import { Button } from '@/components/ui/button'
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
import { queries } from '@/lib/api/queries'
import { COMMUNITY } from '@/lib/constants/edition'
import { formatTokens } from '@/lib/string'

const PLATFORM_ITEMS = [
  { title: 'Dashboard', icon: LayoutDashboard, url: '/dashboard' },
  { title: 'Account', icon: UserRound, url: '/account' },
  { title: 'Control Center', icon: Settings, url: '/settings' },
]

/** This week's tokens against the plan's allowance; hidden until they are known. */
function TokenUsageCard() {
  const { data: quota } = useQuery(queries.quota.status())
  if (!quota) return null
  const limit = quota.limit_tokens

  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">Token usage</span>
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {formatTokens(quota.used_tokens)}
          {limit !== null && ` / ${formatTokens(limit)}`}
        </span>
      </div>
      {limit !== null && <UsageBar used={quota.used_tokens} limit={limit} />}
    </div>
  )
}

/** Second panel of the sidebar-09 shell on the Platform pages. */
export default function PlatformPanel() {
  const pathname = useLocation().pathname

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
      {!COMMUNITY && (
        <SidebarFooter className="gap-2 p-4">
          <TokenUsageCard />
          <div className="grid gap-2 rounded-lg border p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="text-accent-ink size-4" aria-hidden />
              Subscribe now
            </div>
            <p className="text-muted-foreground text-xs">
              Plans for teams and heavier use are on the way.
            </p>
            <Button size="sm" asChild>
              <Link to="/settings/billing">Open billing</Link>
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
