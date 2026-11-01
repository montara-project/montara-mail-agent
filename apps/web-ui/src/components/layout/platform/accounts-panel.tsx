import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Inbox, Plus, SlidersHorizontal } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import { providerColor } from '@/components/block/common/provider-badge'
import TokenUsageCard from '@/components/block/settings/billing/token-usage-card'
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
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { queries } from '@/lib/api/queries'
import { COMMUNITY } from '@/lib/constants/edition'
import { cn } from '@/lib/utils'

/** The brand tile's initial for a provider. */
function brandInitial(provider: string) {
  return provider.charAt(0).toUpperCase()
}

/** Groups the org's accounts by provider, preserving the server's order. */
function groupByProvider(accounts: Models.EmailAccount[]) {
  const groups = new Map<string, Models.EmailAccount[]>()
  for (const account of accounts) {
    const list = groups.get(account.provider) ?? []
    list.push(account)
    groups.set(account.provider, list)
  }
  return [...groups.entries()]
}

/**
 * The /account page's second panel: the unified inbox jump, the connected
 * accounts grouped by provider, the add-account jump and the footer.
 */
export default function AccountsPanel() {
  const { organization } = useActiveOrganization()
  const { data: accounts, isPending } = useQuery(queries.emailAccounts.list(organization?.id))
  const unread = (accounts ?? []).reduce((sum, item) => sum + item.unread, 0)
  // One provider open at a time; the first group starts open like the design.
  const [openProvider, setOpenProvider] = React.useState<string | null>(null)
  const groups = groupByProvider(accounts ?? [])
  const openGroup = openProvider ?? groups[0]?.[0] ?? null

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-2">
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {/* The page's context row: always the unified-inbox jump. */}
                <SidebarMenuButton
                  asChild
                  isActive
                  className="data-active:bg-accent-tint data-active:text-foreground [&_svg]:text-accent-soft"
                >
                  <Link to="/mail">
                    <Inbox />
                    <span>Unified inbox</span>
                    {unread > 0 && (
                      <span className="bg-accent-ink/25 ml-auto rounded-[4px] px-[5px] py-px font-mono text-[9.5px] font-semibold text-accent-soft tabular-nums">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Providers</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="grid gap-1">
              {isPending && organization ? (
                <p className="text-ink-3 px-2 py-1 text-xs">Loading…</p>
              ) : groups.length === 0 ? (
                <p className="text-ink-3 px-2 py-1 text-xs">No account is connected yet.</p>
              ) : (
                groups.map(([provider, list]) => {
                  const color = providerColor(provider)
                  const isOpen = openGroup === provider
                  return (
                    <div key={provider} className={cn('rounded-lg', isOpen && 'bg-muted')}>
                      <button
                        type="button"
                        onClick={() => setOpenProvider(isOpen ? null : provider)}
                        aria-expanded={isOpen}
                        className="hover:bg-accent/50 focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded-[7px] px-2 py-1.5 text-left outline-none focus-visible:ring-2"
                      >
                        <span
                          className="grid size-5 shrink-0 place-items-center rounded-md text-[9.5px] font-bold uppercase"
                          style={
                            color
                              ? {
                                  color,
                                  backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                                }
                              : {
                                  color: 'var(--muted-foreground)',
                                  backgroundColor: 'var(--secondary)',
                                }
                          }
                        >
                          {brandInitial(provider)}
                        </span>
                        <span className="grid min-w-0 flex-1 leading-tight">
                          <span className="truncate text-[11.5px] font-semibold capitalize">
                            {provider}
                          </span>
                          <span className="text-ink-3 truncate text-[9.5px]">
                            {list.length} {list.length === 1 ? 'account' : 'accounts'}
                          </span>
                        </span>
                        {isOpen ? (
                          <ChevronDown className="text-ink-faint size-3 shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="text-ink-faint size-3 shrink-0" aria-hidden />
                        )}
                      </button>
                      {isOpen && (
                        <div className="grid gap-0.5 px-2 pb-1.5 ps-[34px]">
                          {list.map((account) => (
                            <Link
                              key={account.id}
                              to="/mail"
                              search={account.id ? { account: account.id } : {}}
                              className="hover:bg-accent/50 focus-visible:ring-ring/50 flex items-center gap-[7px] rounded-[5px] px-1.5 py-1 outline-none focus-visible:ring-2"
                            >
                              <span
                                aria-hidden
                                className="size-1 shrink-0 rounded-full"
                                style={{
                                  backgroundColor: account.sync_error
                                    ? 'var(--destructive)'
                                    : account.synced_at
                                      ? 'var(--success)'
                                      : 'var(--warning)',
                                }}
                              />
                              <span className="sr-only">
                                {account.sync_error
                                  ? 'Sync failed'
                                  : account.synced_at
                                    ? 'Synced'
                                    : 'Syncing'}
                              </span>
                              <span className="text-muted-foreground min-w-0 flex-1 truncate text-[10px]">
                                {account.email}
                              </span>
                              {account.unread > 0 && (
                                <span className="text-accent-soft font-mono text-[9px] font-semibold tabular-nums">
                                  {account.unread}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="border-border border">
                  <Link to="/account" search={{ connect: '1' }}>
                    <Plus />
                    <span>Add account</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 p-4">
        {!COMMUNITY && <TokenUsageCard />}
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
    </Sidebar>
  )
}
