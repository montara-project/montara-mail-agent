import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'

import MailSidebar from '@/components/layout/mail/mail-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { requireSession } from '@/lib/auth/handler'
import { queries } from '@/lib/api/queries'

/** Mailbox has its own two-panel sidebar, so it lives outside the (app) layout. */
export const Route = createFileRoute('/mail/')({
  beforeLoad: async () => {
    await requireSession()
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { data: meData, isError, refetch } = useQuery(queries.auth.profile())
  const user = meData?.user

  return (
    <SidebarProvider style={{ '--sidebar-width': '350px' } as React.CSSProperties}>
      <MailSidebar
        user={user ? { name: user.name, email: user.email, avatar: '' } : undefined}
        userError={isError && !user}
        onRetryUser={() => void refetch()}
      />
      <SidebarInset>
        <header className="bg-background sticky top-0 flex shrink-0 items-center gap-2 border-b p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage className="font-medium">Inbox</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-sm">
          Select an email to read it.
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
