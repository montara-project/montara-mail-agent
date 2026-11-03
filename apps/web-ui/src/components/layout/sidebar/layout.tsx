import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import React from 'react'

import MailSearchBar from '@/components/layout/mail/mail-search'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { queries } from '@/lib/api/queries'
import { capitalizeFirstLetter } from '@/lib/string'
import { cn } from '@/lib/utils'

import AccountFilter from './account-filter'
import AppSidebar, { hasSidebarPanel } from './app-sidebar'
import HeaderClock from './header-clock'

/** Path segments whose breadcrumb label isn't the segment itself. */
const SEGMENT_LABELS: Record<string, string> = {
  settings: 'Control Center',
  profile: 'My Profile',
  security: 'Security',
  mail: 'Mail',
  'api-keys': 'API Keys',
  organization: 'Organization',
  billing: 'Billing',
  'ai-assistant-panel': 'AI Assistant Panel',
  'agent-bots': 'Agent Bots',
  skills: 'Skills',
  mcp: 'MCP',
  plugins: 'Plugins',
  'ai-providers': 'AI Providers',
  'ip-blocks': 'IP Block',
  'delete-account': 'Delete Account',
  invoice: 'Invoice',
}

const segmentLabel = (segment: string) => SEGMENT_LABELS[segment] ?? capitalizeFirstLetter(segment)

interface SidebarLayoutProps {
  children: React.ReactNode
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = useLocation().pathname
  // Pages without a second panel show just the icon rail.
  const hasPanel = hasSidebarPanel(pathname)
  // On the mail and dashboard pages the topbar filters by account instead.
  const showAccountFilter = pathname === '/mail' || pathname === '/dashboard'

  const { data: meData, isError, refetch } = useQuery(queries.auth.profile())

  const renderBreadcrumb = () => {
    const pathSegments = pathname.split('/').filter(Boolean)

    if (pathSegments.length === 0) {
      return null
    }

    if (pathSegments.length === 1) {
      return (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-foreground">
                {segmentLabel(pathSegments[0])}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )
    }

    return (
      <Breadcrumb>
        <BreadcrumbList>
          {pathSegments.map((segment, index) => {
            const isLast = index === pathSegments.length - 1
            const href = '/' + pathSegments.slice(0, index + 1).join('/')
            const displaySegment = segmentLabel(segment)

            const matchUUID = segment.match(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )

            const newSegment = matchUUID ? '...' + displaySegment.slice(-8) : displaySegment

            return (
              <React.Fragment key={index}>
                <BreadcrumbItem className="hidden md:block">
                  {isLast ? (
                    <BreadcrumbPage className="font-semibold text-foreground">
                      {newSegment}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="text-ink-3 hover:text-foreground"
                      href={href}
                      asChild
                    >
                      <Link to={href}>{newSegment}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          // Rail plus panel; shared by every panel (Platform, Mail) so they line up.
          '--sidebar-width': hasPanel ? '20.5rem' : 'calc(var(--sidebar-width-icon) + 1px)',
        } as React.CSSProperties
      }
    >
      <AppSidebar
        user={meData?.user}
        userError={isError && !meData?.user}
        onRetryUser={() => void refetch()}
      />
      <SidebarInset>
        <header className="sticky bg-background top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b">
          <div className="flex w-full items-center justify-between px-6">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger className={cn('-ml-1', !hasPanel && 'md:hidden')} />
              <Separator
                orientation="vertical"
                className={cn(
                  'my-auto mr-2 data-[orientation=vertical]:h-4',
                  !hasPanel && 'md:hidden'
                )}
              />
              {showAccountFilter ? <AccountFilter /> : renderBreadcrumb()}
              {pathname === '/mail' && <MailSearchBar />}
            </div>
            <HeaderClock />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
