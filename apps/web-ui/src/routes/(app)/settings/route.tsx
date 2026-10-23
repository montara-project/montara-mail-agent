import { createFileRoute, Outlet } from '@tanstack/react-router'

import SettingsNav from '@/components/block/settings/settings-nav'

export const Route = createFileRoute('/(app)/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)] md:items-start">
      <SettingsNav />
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
