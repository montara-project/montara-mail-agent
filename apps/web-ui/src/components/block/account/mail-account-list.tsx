import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRightLeft, Loader2, Plus, RefreshCw, Unplug } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import ProviderBadge from '@/components/block/common/provider-badge'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import StatusDot from '@/components/block/common/status-dot'
import { useSplitInbox } from '@/components/layout/mail/mail-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { timeAgo } from '@/lib/date'

import { ProviderIcon } from './connector-list'

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
    return <StatusDot status="pending" label="Syncing..." />
  }
  return <StatusDot status="synced" label={`Synced ${timeAgo(new Date(account.synced_at))}`} />
}

/** Connected mail accounts of the active organization; each card opens that account's mailbox. */
export default function MailAccountList() {
  const { organization, organizations } = useActiveOrganization()
  const { mask } = useHideEmails()
  const split = useSplitInbox()
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
  const transfer = useMutation(queries.emailAccounts.transfer())
  const [moving, setMoving] = React.useState<Models.EmailAccount | null>(null)
  const [moveTarget, setMoveTarget] = React.useState<string>('')
  // The member-scoped list is the user's own organizations; the account can
  // only move within them, so it never changes hands between users.
  const otherOrgs = organizations.filter((o) => o.id !== organization?.id)

  const content = () => {
    if (isPending && organization) {
      return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
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
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          No account is connected yet. Pick a provider below.
        </p>
      )
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="bg-card border-border/60 shadow-hairline grid gap-3.5 rounded-lg border p-[18px] text-sm"
          >
            <div className="flex items-start gap-3">
              <Link
                to="/mail"
                search={split ? { account: account.id } : {}}
                className="focus-visible:ring-ring/50 -my-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 outline-none focus-visible:ring-[3px]"
              >
                <ProviderIcon
                  provider={account.provider}
                  tint={false}
                  className="rounded-[11px] bg-secondary"
                />
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-semibold hover:underline">
                    {mask(account.label)}
                  </span>
                  <span className="text-muted-foreground truncate text-xs">
                    {mask(account.email)}
                  </span>
                </span>
              </Link>
              <ProviderBadge provider={account.provider} className="mt-2.5 shrink-0" />
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <SyncStatus account={account} />
              {account.unread > 0 && (
                <Badge variant="secondary" size="sm" className="shrink-0">
                  {account.unread} unread
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                variant="secondary"
                className="h-7 rounded-lg bg-secondary text-[11.5px] font-medium text-muted-foreground shadow-none [&_svg]:size-3"
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
              <Button
                variant="secondary"
                className="h-7 rounded-lg bg-secondary text-[11.5px] font-medium text-muted-foreground shadow-none [&_svg]:size-3"
                disabled={otherOrgs.length === 0}
                onClick={() => {
                  setMoveTarget('')
                  setMoving(account)
                }}
              >
                <ArrowRightLeft />
                Move
              </Button>
              <Button
                variant="secondary"
                className="text-ink-faint hover:text-muted-foreground h-7 rounded-lg bg-secondary text-[11.5px] font-medium shadow-none [&_svg]:size-3"
                onClick={() => setDisconnecting(account)}
              >
                <Unplug />
                Disconnect
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const failing = (accounts ?? []).filter((account) => account.sync_error).length
  const synced = (accounts ?? [])
    .map((account) => account.synced_at)
    .filter((value): value is string => !!value)
  const lastSync = synced.length
    ? timeAgo(new Date(Math.max(...synced.map((d) => new Date(d).getTime()))))
    : null

  const scrollToConnect = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document
      .getElementById('connect-section')
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <section aria-labelledby="mail-accounts-title" className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h2 id="mail-accounts-title" className="text-lg font-semibold">
            Email accounts
          </h2>
          <p className="text-muted-foreground text-sm">
            {accounts?.length
              ? `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'} connected${lastSync ? ` · last sync ${lastSync}` : ''}`
              : 'Connect your first mailbox below.'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <StatusDot
            status={failing > 0 ? 'failed' : 'healthy'}
            label={
              failing > 0
                ? `${failing} connection${failing === 1 ? '' : 's'} need attention`
                : 'All connections healthy'
            }
          />
          <Button className="h-8 rounded-lg" onClick={scrollToConnect}>
            <Plus />
            Add account
          </Button>
        </div>
      </div>
      {content()}
      <p className="text-ink-3 text-[11.5px]">
        Disconnecting an account removes local messages but keeps the mailbox itself untouched.
      </p>
      <Dialog open={!!moving} onOpenChange={(open) => !open && setMoving(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
          <div className="grid gap-4 p-6">
            <div className="grid gap-1.5 pe-8">
              <DialogTitle>Move {mask(moving?.email ?? '')}</DialogTitle>
              <DialogDescription>
                The account, its mail and its agent data move to another organization of yours — the
                account never changes hands between users.
              </DialogDescription>
            </div>
            {otherOrgs.length ? (
              <Select value={moveTarget} onValueChange={setMoveTarget}>
                <SelectTrigger aria-label="Target organization">
                  <SelectValue placeholder="Pick a target organization" />
                </SelectTrigger>
                <SelectContent>
                  {otherOrgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-muted-foreground text-sm">No other organization to move it to.</p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t p-4">
            <Button variant="outline" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button
              disabled={!moveTarget || transfer.isPending}
              onClick={() =>
                moving &&
                moveTarget &&
                transfer.mutate(
                  { id: moving.id, organization_id: moveTarget },
                  {
                    onSuccess: (_account, variables) => {
                      const target = organizations.find((o) => o.id === variables.organization_id)
                      toast.success(
                        `${mask(moving.email)} moved to ${target?.name ?? 'the organization'}`
                      )
                      setMoving(null)
                    },
                    onError: toastAxiosError,
                  }
                )
              }
            >
              {transfer.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Move account
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
