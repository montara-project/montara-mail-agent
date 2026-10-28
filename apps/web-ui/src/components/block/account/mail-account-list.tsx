import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { RefreshCw, Unplug } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

import { CONNECTORS, ProviderIcon } from './connector-list'

/** When the account last synced, or why it could not. */
function SyncStatus({ account }: { account: Models.EmailAccount }) {
  if (account.sync_error) {
    return (
      <span className="text-destructive line-clamp-2" title={account.sync_error}>
        Sync failed: {account.sync_error}
      </span>
    )
  }
  if (!account.synced_at) {
    return (
      <span className="flex items-center gap-1.5">
        <RefreshCw className="size-3 animate-spin motion-reduce:animate-none" />
        Syncing...
      </span>
    )
  }
  return <span>Synced {formatDistanceToNow(new Date(account.synced_at), { addSuffix: true })}</span>
}

/** Connected mail accounts of the active organization; each card opens that account's mailbox. */
export default function MailAccountList() {
  const { organization } = useActiveOrganization()
  const { mask } = useHideEmails()
  const {
    data: accounts,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery(queries.emailAccounts.list(organization?.id))
  const sync = useMutation(queries.emailAccounts.sync())
  const disconnect = useMutation(queries.emailAccounts.delete())
  const [disconnecting, setDisconnecting] = React.useState<Models.EmailAccount | null>(null)

  const content = () => {
    if (isPending && organization) {
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      )
    }
    if (isError) {
      return (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-destructive">{axiosErrorMessage(error)}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw />
            Try again
          </Button>
        </div>
      )
    }
    if (!accounts?.length) {
      return (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          No account is connected yet. Pick a provider below.
        </p>
      )
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <div key={account.id} className="bg-card grid gap-3 rounded-xl border p-4 text-sm">
            <Link
              to="/mail"
              search={{ account: account.id }}
              className="focus-visible:ring-ring/50 -m-1 flex items-center gap-3 rounded-lg p-1 outline-none focus-visible:ring-[3px]"
            >
              <ProviderIcon provider={account.provider} />
              <div className="grid min-w-0 flex-1">
                <span className="truncate font-semibold hover:underline">
                  {mask(account.label)}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {mask(account.email)}
                </span>
              </div>
              {account.unread > 0 && <Badge>{account.unread} unread</Badge>}
            </Link>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <span>
                {CONNECTORS.find((c) => c.id === account.provider)?.name ?? account.provider}
              </span>
              <SyncStatus account={account} />
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={sync.isPending && sync.variables === account.id}
                onClick={() =>
                  sync.mutate(account.id, {
                    onSuccess: () => toast.success(`${mask(account.email)} is up to date`),
                    onError: toastAxiosError,
                  })
                }
              >
                <RefreshCw
                  className={
                    sync.isPending && sync.variables === account.id
                      ? 'animate-spin motion-reduce:animate-none'
                      : undefined
                  }
                />
                Sync now
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDisconnecting(account)}>
                <Unplug />
                Disconnect
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <section aria-labelledby="mail-accounts-title" className="grid gap-3">
      <div>
        <h2 id="mail-accounts-title" className="text-lg font-semibold">
          Email accounts
        </h2>
        <p className="text-muted-foreground text-sm">Pick an account to open its mailbox.</p>
      </div>
      {content()}
      <SimpleAlertDialog
        open={!!disconnecting}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={`Disconnect ${mask(disconnecting?.email ?? '')}?`}
        description="Its synced mail is removed from Montara. The mailbox itself is not touched."
        confirmText="Disconnect"
        onConfirm={() =>
          disconnecting &&
          disconnect.mutate(disconnecting.id, {
            onSuccess: () => toast.success(`${mask(disconnecting.email)} disconnected`),
            onError: toastAxiosError,
          })
        }
      />
    </section>
  )
}
