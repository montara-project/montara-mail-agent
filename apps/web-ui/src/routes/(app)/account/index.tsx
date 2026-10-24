import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React from 'react'
import { toast } from 'sonner'

import ConnectorList from '@/components/block/account/connector-list'
import MailAccountList from '@/components/block/account/mail-account-list'

// The OAuth callback returns the browser here with the flow's outcome in the
// query, which the route toasts and strips.
type AccountSearch = { connected?: string; error?: string }

export const Route = createFileRoute('/(app)/account/')({
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
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
    else toast.success(`${connected} connected; its mail is syncing`)
    navigate({ to: '/account', search: {} })
  }, [connected, error, navigate])
  return null
}

function RouteComponent() {
  return (
    <div className="grid gap-8">
      <OAuthOutcome />
      <MailAccountList />
      <ConnectorList />
    </div>
  )
}
