import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React from 'react'
import { toast } from 'sonner'

import EmptyState from '@/components/block/common/empty-state'
import MCPServerList from '@/components/block/mcp/mcp-server-list'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'

// A hosted server's sign-in returns the browser here with how it went in the
// query, which the route toasts and strips.
type MCPSearch = { connected?: string; error?: string }

export const Route = createFileRoute('/(app)/settings/mcp')({
  validateSearch: (search: Record<string, unknown>): MCPSearch => ({
    connected: typeof search.connected === 'string' ? search.connected : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: RouteComponent,
})

function OAuthOutcome() {
  const { connected, error } = Route.useSearch()
  const navigate = useNavigate()
  React.useEffect(() => {
    if (!connected && !error) return
    if (error) toast.error(error)
    else toast.success(`${connected} connected; its tools are synced`)
    navigate({ to: '/settings/mcp', search: {}, replace: true })
  }, [connected, error, navigate])
  return null
}

function RouteComponent() {
  const { organization, isPending } = useActiveOrganization()

  if (isPending) return <Skeleton className="h-40" />
  if (!organization) {
    return (
      <EmptyState
        title="No organization selected"
        description="Create or switch to an organization to manage its MCP servers."
      />
    )
  }
  return (
    <>
      <OAuthOutcome />
      <MCPServerList organizationId={organization.id} />
    </>
  )
}
