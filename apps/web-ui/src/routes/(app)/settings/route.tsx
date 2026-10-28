import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

import PageContainer from '@/components/block/common/page-container'

export const Route = createFileRoute('/(app)/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const isIndex = useLocation().pathname.replace(/\/$/, '') === '/settings'

  return (
    <PageContainer>
      {/* The header's breadcrumb leads back on wider screens; phones hide it. */}
      {!isIndex && (
        <Link
          to="/settings"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm md:hidden"
        >
          <ChevronLeft className="size-4" />
          Control Center
        </Link>
      )}
      <Outlet />
    </PageContainer>
  )
}
