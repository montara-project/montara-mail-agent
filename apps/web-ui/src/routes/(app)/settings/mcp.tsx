import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React from 'react'
import { toast } from 'sonner'

import MCPServerList from '@/components/block/mcp/mcp-server-list'
import NoOrganization, { OrganizationsError } from '@/components/block/settings/no-organization'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

// A hosted server's sign-in returns the browser here with the code and state
// (or an error); the route finishes it as the signed-in user, toasts how it
// went and strips the query.
type MCPSearch = { code?: string; state?: string; error?: string }

const str = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)

export const Route = createFileRoute('/(app)/settings/mcp')({
  validateSearch: (search: Record<string, unknown>): MCPSearch => ({
    code: str(search.code),
    state: str(search.state),
    error: str(search.error),
  }),
  component: RouteComponent,
})

function OAuthOutcome() {
  const { code, state, error } = Route.useSearch()
  const navigate = useNavigate()
  const finish = useMutation(queries.mcpServers.oauthFinish())
  // React runs the effect twice in development; a code is good for one exchange.
  const started = React.useRef(false)
  React.useEffect(() => {
    if (started.current || (!error && !(code && state))) return
    started.current = true
    navigate({ to: '/settings/mcp', search: {}, replace: true })
    if (error || !code || !state) {
      toast.error(error ?? 'The sign-in came back incomplete')
      return
    }
    finish.mutate(
      { code, state },
      {
        onSuccess: ({ name }) => toast.success(`${name} connected; its tools are synced`),
        onError: (err) => toast.error(axiosErrorMessage(err)),
      }
    )
  }, [code, state, error, navigate, finish])
  return null
}

function RouteComponent() {
  const { organization, isPending, isError } = useActiveOrganization()

  if (isPending) return <Skeleton className="h-40" />
  if (isError) {
    return <OrganizationsError />
  }
  if (!organization) {
    return (
      <NoOrganization description="Create or switch to an organization to manage its MCP servers." />
    )
  }
  return (
    <>
      <OAuthOutcome />
      <MCPServerList organizationId={organization.id} />
    </>
  )
}
