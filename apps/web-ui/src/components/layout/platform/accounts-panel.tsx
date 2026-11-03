import { useQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { ChevronRight, Inbox, Layers, SlidersHorizontal, Tag } from 'lucide-react'
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
import { useHideEmails } from '@/hooks/use-hide-emails'
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
 * accounts grouped by provider, the label views and the footer.
 */
export default function AccountsPanel() {
  const { organization } = useActiveOrganization()
  const { mask } = useHideEmails()
  const { data: accounts, isPending } = useQuery(queries.emailAccounts.list(organization?.id))
  const unread = (accounts ?? []).reduce((sum, item) => sum + item.unread, 0)
  // One provider open at a time. Until the user picks, the first group is open;
  // null means they closed it, so it must not fall back to the first group again.
  const [openProvider, setOpenProvider] = React.useState<string | null>()
  const groups = groupByProvider(accounts ?? [])
  const openGroup = openProvider === undefined ? (groups[0]?.[0] ?? null) : openProvider
  // The same filter as the page's tabs: both read the URL's view.
  const { view } = useSearch({ strict: false })
  const labeled = (accounts ?? []).filter((account) => account.label)
  const labels = [...new Set(labeled.map((account) => account.label))]
  const activeView = view && labels.includes(view) ? view : undefined
  const views = [
    { label: undefined, title: 'All accounts', icon: Layers, count: accounts?.length ?? 0 },
    ...labels.map((label) => ({
      label,
      title: label,
      icon: Tag,
      count: labeled.filter((account) => account.label === label).length,
    })),
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
                {/* The page's context row: always the unified-inbox jump. */}
                <SidebarMenuButton
                  asChild
                  isActive
                  className="data-active:bg-accent-tint data-active:text-foreground h-[30px] [&_svg]:text-accent-soft"
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
                    <div
                      key={provider}
                      className={cn(
                        'rounded-lg transition-colors duration-200 motion-reduce:transition-none',
                        isOpen && 'bg-muted'
                      )}
                    >
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
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate text-[11.5px] leading-4 font-semibold capitalize">
                            {provider}
                          </span>
                          <span className="text-ink-3 truncate text-[9.5px] leading-[13px]">
                            {list.length} {list.length === 1 ? 'account' : 'accounts'}
                          </span>
                        </span>
                        <ChevronRight
                          className={cn(
                            'text-ink-faint size-3 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none',
                            isOpen && 'rotate-90'
                          )}
                          aria-hidden
                        />
                      </button>
                      {/* Stays mounted so the height can animate; inert keeps a closed
                      group's links out of the tab order. */}
                      <div
                        inert={!isOpen}
                        className={cn(
                          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
                          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="grid gap-0.5 px-2 pb-1.5 ps-[30px]">
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
                                  {mask(account.email)}
                                </span>
                                {account.unread > 0 && (
                                  <span className="text-accent-soft font-mono text-[9px] font-semibold tabular-nums">
                                    {account.unread}
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
        {labels.length > 0 && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Views</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {views.map((item) => {
                  const active = activeView === item.label
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active} className="text-[11.5px]">
                        <Link to="/account" search={{ view: item.label }} resetScroll={false}>
                          <item.icon />
                          <span className="truncate">{item.title}</span>
                          <span
                            className={cn(
                              'ml-auto rounded-[4px] px-[5px] py-px font-mono text-[9.5px] font-semibold tabular-nums',
                              active ? 'bg-accent-ink/20 text-accent-soft' : 'bg-muted text-ink-3'
                            )}
                          >
                            {item.count}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
