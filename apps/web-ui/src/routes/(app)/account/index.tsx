import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React from 'react'
import { toast } from 'sonner'

import ConnectorList from '@/components/block/account/connector-list'
import MailAccountList from '@/components/block/account/mail-account-list'
import PageContainer from '@/components/block/common/page-container'
import { maskEmails, useHideEmails } from '@/hooks/use-hide-emails'

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
  const { hidden } = useHideEmails()
  React.useEffect(() => {
    if (!connected && !error) return
    if (error) toast.error(error)
    else
      toast.success(`${hidden ? maskEmails(connected!) : connected} connected; its mail is syncing`)
    navigate({ to: '/account', search: {} })
  }, [connected, error, hidden, navigate])
  return null
}

function RouteComponent() {
  return (
    <PageContainer className="gap-8">
      <OAuthOutcome />
      <MailAccountList />
      <ConnectorList />
    </PageContainer>
  )
}
