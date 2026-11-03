import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Loader2, Move, Plus, RefreshCw, Unlink } from 'lucide-react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { isPast, timeAgo } from '@/lib/date'
import { cn } from '@/lib/utils'

import {
  ConnectDialog,
  CONNECTORS,
  PROVIDER_TILE,
  ProviderIcon,
  type Connector,
} from './connector-list'

const ACTION = 'h-7 rounded-[0.5rem] px-2 text-[0.78125rem] shadow-none'
const QUIET_ACTION = cn(
  ACTION,
  'bg-muted text-ink-3 hover:bg-accent hover:text-foreground font-medium'
)
/** How old a sync may get before its dot turns amber: the sync job's default interval. */
const STALE_AFTER_MS = 5 * 60 * 1000

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
      <StatusDot className="text-ink-3 text-[0.78125rem]" status="pending" label="Syncing..." />
    )
  }
  const synced = new Date(account.synced_at)
  return (
    <StatusDot
      className="text-ink-3 text-[0.78125rem]"
      status={isPast(new Date(synced.getTime() + STALE_AFTER_MS)) ? 'pending' : 'synced'}
      label={`Synced ${timeAgo(synced)}`}
    />
  )
}

/** One pill in the label filter; the design's tab row over the grid. */
function FilterTab({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 flex items-center gap-1.5 rounded-[0.4375rem] px-[0.6875rem] py-1.5 text-xs leading-[0.9375rem] outline-none focus-visible:ring-[0.1875rem]',
        active
          ? 'bg-secondary font-semibold text-foreground'
          : 'text-muted-foreground hover:text-foreground font-medium'
      )}
    >
      {label}
      <span className="text-ink-3 text-[0.75rem] font-medium tabular-nums">{count}</span>
    </button>
  )
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
  const [connecting, setConnecting] = React.useState<Connector | null>(null)
  // The member-scoped list is the user's own organizations; the account can
  // only move within them, so it never changes hands between users.
  const otherOrgs = organizations.filter((o) => o.id !== organization?.id)
  // The design's label filter: All accounts, then one tab per label in use. It
  // lives in the URL so the sidebar's views share it; a label no account has
  // any more falls back to all.
  const navigate = useNavigate()
  const { view } = useSearch({ strict: false })
  const labeled = (accounts ?? []).filter((account) => account.label)
  const labels = [...new Set(labeled.map((account) => account.label))]
  const filter = view && labels.includes(view) ? view : 'all'
  const setFilter = (label?: string) =>
    navigate({ to: '/account', search: { view: label }, replace: true, resetScroll: false })
  const visible =
    filter === 'all'
      ? (accounts ?? [])
      : (accounts ?? []).filter((account) => account.label === filter)

  const content = () => {
    if (isPending && organization) {
      return (
        <div className="grid gap-3 gap-x-[1.125rem] sm:grid-cols-2">
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
      <div className="grid gap-3 gap-x-[1.125rem] sm:grid-cols-2">
        {visible.map((account) => (
          <div
            key={account.id}
            className="bg-card border-border/60 shadow-hairline grid gap-3.5 rounded-lg border p-[1.0625rem] text-sm"
          >
            <div className="flex items-center gap-3">
              <Link
                to="/mail"
                search={split ? { account: account.id } : {}}
                className="focus-visible:ring-ring/50 -m-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 outline-none focus-visible:ring-[0.1875rem]"
              >
                <ProviderIcon
                  provider={account.provider}
                  tint={false}
                  className={cn(PROVIDER_TILE, '[&>img]:size-5')}
                />
                <span className="grid min-w-0 flex-1 gap-[0.1875rem]">
                  <span className="truncate leading-[1.0625rem] font-semibold hover:underline">
                    {mask(account.label)}
                  </span>
                  <span className="text-ink-3 truncate text-xs leading-[0.9375rem]">
                    {mask(account.email)}
                  </span>
                </span>
              </Link>
              <ProviderBadge
                provider={
                  CONNECTORS.find((item) => item.id === account.provider)?.name ?? account.provider
                }
                className="shrink-0"
              />
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
              <SyncStatus account={account} />
              {/* The design's tag chip; the unread badge stands in for unlabeled accounts. */}
              {account.label ? (
                <span className="bg-muted text-muted-foreground shrink-0 rounded-[0.3125rem] px-[0.4375rem] py-[0.1875rem] text-[0.71875rem] leading-[0.8125rem] font-medium">
                  {account.label}
                </span>
              ) : (
                account.unread > 0 && (
                  <Badge variant="secondary" size="sm" className="shrink-0">
                    {account.unread} unread
                  </Badge>
                )
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-1.5">
              <Button
                variant="secondary"
                className={QUIET_ACTION}
                disabled={sync.isPending && sync.variables === account.id}
                onClick={() =>
                  sync.mutate(account.id, {
                    onSuccess: () => toast.success(`${mask(account.email)} is up to date`),
                    onError: toastAxiosError,
                  })
                }
              >
                <RefreshCw
                  className={cn(
                    'size-3',
                    sync.isPending &&
                      sync.variables === account.id &&
                      'animate-spin motion-reduce:animate-none'
                  )}
                />
                Sync now
              </Button>
              <Button
                variant="secondary"
                className={QUIET_ACTION}
                disabled={otherOrgs.length === 0}
                onClick={() => {
                  setMoveTarget('')
                  setMoving(account)
                }}
              >
                <Move className="size-3" />
                Move
              </Button>
              <Button
                variant="secondary"
                className={cn(
                  ACTION,
                  'border-destructive/25 bg-card text-danger-soft hover:bg-destructive/10 dark:bg-destructive/12 dark:hover:bg-destructive/20 border font-semibold'
                )}
                onClick={() => setDisconnecting(account)}
              >
                <Unlink className="size-3" />
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

  return (
    <section aria-labelledby="mail-accounts-title" className="grid gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h2 id="mail-accounts-title" className="text-lg leading-[1.5625rem] font-semibold">
            Email accounts
          </h2>
          <p className="text-muted-foreground text-sm leading-[1.1875rem]">
            {accounts?.length
              ? `${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'} connected${lastSync ? ` · last sync ${lastSync}` : ''}`
              : 'Connect your first mailbox below.'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-8 rounded-[0.5rem] text-xs font-semibold shadow-none">
              <Plus className="size-3.5" />
              Add account
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            {CONNECTORS.map((connector) => (
              <DropdownMenuItem key={connector.id} onClick={() => setConnecting(connector)}>
                <ProviderIcon
                  provider={connector.id}
                  tint={false}
                  className="size-5 bg-transparent [&>img]:size-4 [&>svg]:size-4"
                />
                {connector.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* The design's filter bar: label tabs left, the connections' health right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {labels.length > 0 && (
          <div
            role="group"
            aria-label="Filter accounts by label"
            className="bg-card border-border/60 flex flex-wrap items-center gap-1.5 rounded-[0.625rem] border p-[0.1875rem]"
          >
            <FilterTab
              active={filter === 'all'}
              label="All accounts"
              count={accounts?.length ?? 0}
              onClick={() => setFilter()}
            />
            {labels.map((label) => (
              <FilterTab
                key={label}
                active={filter === label}
                label={label}
                count={labeled.filter((account) => account.label === label).length}
                onClick={() => setFilter(label)}
              />
            ))}
          </div>
        )}
        {/* Only a loaded, non-empty list can vouch for its connections. */}
        {!!accounts?.length && (
          <StatusDot
            className={cn(
              'text-ink-3 gap-2',
              labels.length === 0 && 'bg-card border-border/60 rounded-[0.625rem] border p-2'
            )}
            status={failing > 0 ? 'failed' : 'healthy'}
            label={
              failing > 0
                ? `${failing} connection${failing === 1 ? '' : 's'} need attention`
                : 'All connections healthy'
            }
          />
        )}
      </div>
      {content()}
      <p className="text-ink-3 text-[0.78125rem] leading-4">
        Disconnecting an account removes local messages but keeps them on the server.
      </p>
      {connecting && <ConnectDialog connector={connecting} onClose={() => setConnecting(null)} />}
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
