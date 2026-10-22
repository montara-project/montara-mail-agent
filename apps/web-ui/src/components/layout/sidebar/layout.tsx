import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import React from 'react'

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

import AppSidebar, { hasSidebarPanel } from './app-sidebar'

interface SidebarLayoutProps {
  children: React.ReactNode
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = useLocation().pathname
  // Pages without a second panel show just the icon rail.
  const hasPanel = hasSidebarPanel(pathname)

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
              <BreadcrumbPage className="font-medium">
                {capitalizeFirstLetter(pathSegments[0])}
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
            const displaySegment = capitalizeFirstLetter(segment)

            const matchUUID = segment.match(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            )

            const newSegment = matchUUID ? '...' + displaySegment.slice(-8) : displaySegment

            return (
              <React.Fragment key={index}>
                <BreadcrumbItem className="hidden md:block">
                  {isLast ? (
                    <BreadcrumbPage className="font-medium">{newSegment}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="font-medium" href={href} asChild>
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
          '--sidebar-width': hasPanel ? '420px' : 'calc(var(--sidebar-width-icon) + 1px)',
        } as React.CSSProperties
      }
    >
      <AppSidebar
        user={meData?.user}
        userError={isError && !meData?.user}
        onRetryUser={() => void refetch()}
      />
      <SidebarInset>
        <header className="sticky bg-background top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center justify-between px-4">
            <div className="flex items-center justify-center gap-2">
              <SidebarTrigger className={cn('-ml-1', !hasPanel && 'md:hidden')} />
              <Separator
                orientation="vertical"
                className={cn(
                  'my-auto mr-2 data-[orientation=vertical]:h-4',
                  !hasPanel && 'md:hidden'
                )}
              />
              {renderBreadcrumb()}
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
