import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bot,
  BrainCircuit,
  Building2,
  CreditCard,
  Inbox,
  KeyRound,
  type LucideIcon,
  Package,
  Plug,
  Settings,
  ShieldBan,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  Wand2,
} from 'lucide-react'

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
import { queries } from '@/lib/api/queries'
import { COMMUNITY } from '@/lib/constants/edition'

/** One page of the Control Center; one without a url isn't built yet and shows as Soon. */
type SettingsPanelItem = { title: string; icon: LucideIcon; url?: string; soon?: boolean }

const SETTINGS_GROUPS: { title: string; items: SettingsPanelItem[] }[] = [
  {
    title: 'Account',
    items: [
      { title: 'My Profile', icon: User, url: '/settings/profile' },
      { title: 'Mail', icon: Inbox, url: '/settings/mail' },
      { title: 'Security', icon: ShieldCheck, url: '/settings/security' },
      { title: 'API Keys', icon: KeyRound, url: '/settings/api-keys' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { title: 'Organization', icon: Building2, url: '/settings/organization' },
      // The Community Edition takes no payments.
      ...(COMMUNITY ? [] : [{ title: 'Billing', icon: CreditCard, url: '/settings/billing' }]),
    ],
  },
  {
    title: 'Agent tools',
    items: [
      { title: 'Agent Bots', icon: Bot, url: '/settings/agent-bots' },
      { title: 'AI Assistant Panel', icon: Sparkles, url: '/settings/ai-assistant-panel' },
      { title: 'Skills', icon: Wand2, url: '/settings/skills' },
      { title: 'MCP', icon: Plug, url: '/settings/mcp' },
      // The page exists, but the registry behind it isn't open yet.
      { title: 'Plugins', icon: Package, url: '/settings/plugins', soon: true },
    ],
  },
]

/** Server-wide settings, shown to a super user only. */
const PLATFORM_GROUP: { title: string; items: SettingsPanelItem[] } = {
  title: 'Platform',
  items: [
    { title: 'AI Providers', icon: BrainCircuit, url: '/settings/ai-providers' },
    { title: 'IP Block', icon: ShieldBan, url: '/settings/ip-blocks' },
    { title: 'Delete Account', icon: Trash2, url: '/settings/delete-account' },
  ],
}

/** Second panel of the sidebar-09 shell on the Control Center pages. */
export default function SettingsPanel() {
  const pathname = useLocation().pathname
  const { data: security } = useQuery(queries.profile.security())
  const groups = security?.super_user ? [...SETTINGS_GROUPS, PLATFORM_GROUP] : SETTINGS_GROUPS

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-2">
        <OrganizationSwitcher />
        <Link
          to="/mail"
          className="hover:bg-accent focus-visible:ring-ring/50 flex items-center gap-2 rounded-control px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px]"
        >
          <ArrowLeft className="text-muted-foreground size-4 shrink-0" aria-hidden />
          Back to Mail
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-ink-3 text-[10px] font-semibold tracking-wider uppercase">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    {item.url ? (
                      <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
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
      {!COMMUNITY && (
        <SidebarFooter className="gap-1 p-4">
          <TokenUsageCard />
          <Link
            to="/settings"
            className="hover:bg-accent flex items-center gap-2 rounded-control px-2 py-2 text-sm outline-none"
          >
            <Settings className="text-muted-foreground size-4 shrink-0" aria-hidden />
            Control Center
          </Link>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
