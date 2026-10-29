import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import React from 'react'
import { toast } from 'sonner'

import ConnectorList from '@/components/block/account/connector-list'
import MailAccountList from '@/components/block/account/mail-account-list'
import PageContainer from '@/components/block/common/page-container'
import { maskEmails, useHideEmails } from '@/hooks/use-hide-emails'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

// The OAuth callback returns the browser here with the provider's code and
// the flow's state (or an error), and the route finishes the connection as
// the signed-in user, toasts how it went and strips the query.
type AccountSearch = { oauth?: string; code?: string; state?: string; error?: string }

const str = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)

export const Route = createFileRoute('/(app)/account/')({
  validateSearch: (search: Record<string, unknown>): AccountSearch => ({
    oauth: str(search.oauth),
    code: str(search.code),
    state: str(search.state),
    error: str(search.error),
  }),
  component: RouteComponent,
})

function OAuthOutcome() {
  const { oauth, code, state, error } = Route.useSearch()
  const navigate = useNavigate()
  const { hidden } = useHideEmails()
  const finish = useMutation(queries.emailAccounts.oauthFinish())
  // React runs the effect twice in development; a code is good for one exchange.
  const started = React.useRef(false)
  React.useEffect(() => {
    if (started.current || (!error && !(oauth && code && state))) return
    started.current = true
    navigate({ to: '/account', search: {}, replace: true })
    if (error || !oauth || !code || !state) {
      toast.error(error ?? 'The sign-in came back incomplete')
      return
    }
    finish.mutate(
      { provider: oauth, code, state },
      {
        onSuccess: ({ email }) =>
          toast.success(`${hidden ? maskEmails(email) : email} connected; its mail is syncing`),
        onError: (err) => toast.error(axiosErrorMessage(err)),
      }
    )
  }, [oauth, code, state, error, hidden, navigate, finish])
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
