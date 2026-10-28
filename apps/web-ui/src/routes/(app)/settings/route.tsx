import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'

export const Route = createFileRoute('/(app)/settings')({
  component: RouteComponent,
})

function RouteComponent() {
  const isIndex = useLocation().pathname.replace(/\/$/, '') === '/settings'

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      {/* The header's breadcrumb leads back on wider screens; phones hide it. */}
      {!isIndex && (
        <Link
          to="/settings"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm md:hidden"
        >
          <ChevronLeft className="size-4" />
          Settings
        </Link>
      )}
      <Outlet />
    </div>
  )
}
