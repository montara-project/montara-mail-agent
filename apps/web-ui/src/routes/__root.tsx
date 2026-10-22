import type { QueryClient } from '@tanstack/react-query'

import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import ErrorPage from '@/components/block/common/error-page'
import NotFoundPage from '@/components/block/common/not-found-page'
import { Toaster } from '@/components/ui/sonner'
import DecorationProvider from '@/lib/providers/decoration'

/**
 * Root layout component that serves as the main wrapper for the application.
 *
 * Routing conventions:
 * - Use brackets for route grouping: (group)
 * - Prefix with `-` to ignore: -directory/ or -file.tsx
 * - File-based routing supported: e.g. students.add.tsx creates /students/add
 *
 * @see https://tanstack.com/router/latest/docs/framework/react/routing/routing-concepts
 */
const RootLayout = () => (
  <DecorationProvider>
    {/* outlet = react children */}
    <Outlet />
    <Toaster position="bottom-right" richColors closeButton />

    {/* declare devtools panel */}
    {import.meta.env.DEV && (
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
          {
            name: 'Tanstack Query',
            render: <ReactQueryDevtoolsPanel />,
          },
        ]}
      />
    )}
  </DecorationProvider>
)

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RootError,
})

function RootError({ error }: ErrorComponentProps) {
  const router = useRouter()
  // invalidate() re-runs the loaders and resets the error boundary.
  return <ErrorPage error={error} onRetry={() => void router.invalidate()} />
}
