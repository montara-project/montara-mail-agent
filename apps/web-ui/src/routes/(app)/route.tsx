import { createFileRoute, Outlet } from '@tanstack/react-router'

import SidebarLayout from '@/components/layout/sidebar/layout'
import { requireSession } from '@/lib/auth/handler'

/** Every route under (app) requires a live session. */
export const Route = createFileRoute('/(app)')({
  beforeLoad: async () => {
    await requireSession()
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <SidebarLayout>
      <Outlet />
    </SidebarLayout>
  )
}
