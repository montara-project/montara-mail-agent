import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  ChevronRight,
  Copy,
  Info,
  LogIn,
  Pencil,
  Plug,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  Link2,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import QueryState from '@/components/block/common/query-state'
import SectionHeading from '@/components/block/common/section-heading'
import { SettingsCard, SettingsPage } from '@/components/block/common/settings-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import MCPServerDialog from '@/components/block/mcp/mcp-server-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { MCP_ENDPOINT } from '@/lib/constants/mcp'
import { timeAgo } from '@/lib/date'
import { cn } from '@/lib/utils'

const KIND_LABELS: Record<Models.MCPServerKind, string> = {
  hosted: 'Hosted',
  http: 'HTTP',
  command: 'Command',
}

/** How each status reads: its word, and the tint its dot, chip and tile share. */
const STATUS_LOOK: Record<
  Models.MCPServerStatus,
  { label: string; dot: string; chip: string; tile: string }
> = {
  connected: {
    label: 'Connected',
    dot: 'bg-success',
    chip: 'bg-success/12 text-success-text',
    tile: 'bg-success/12 text-success-text',
  },
  needs_auth: {
    label: 'Needs sign-in',
    dot: 'bg-warning',
    chip: 'bg-warning/12 text-warning-ink',
    tile: 'bg-warning/12 text-warning-ink',
  },
  error: {
    label: 'Error',
    dot: 'bg-destructive',
    chip: 'bg-destructive/12 text-danger-ink',
    tile: 'bg-destructive/12 text-danger-ink',
  },
  pending: {
    label: 'Not synced',
    dot: 'bg-ink-faint',
    chip: 'bg-muted text-ink-3',
    tile: 'bg-muted text-ink-3',
  },
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Outside a secure context navigator.clipboard is undefined; the promise turns that into the failure toast.
const copy = (text: string, what: string) =>
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(text))
    .then(
      () => toast.success(`${what} copied`),
      () => toast.error(`Couldn't copy the ${what.toLowerCase()}; select it instead.`)
    )

/** "Connected", "Needs sign-in": a dot and a word, coloured for the ones that want a look. */
function StatusChip({ status }: { status: Models.MCPServerStatus }) {
  const look = STATUS_LOOK[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-[5px] rounded-tag px-[7px] py-[3px] text-[10.5px] leading-[14px] font-semibold',
        look.chip
      )}
    >
      <span aria-hidden className={cn('size-[5px] shrink-0 rounded-full', look.dot)} />
      {look.label}
    </span>
  )
}

/** One tool: its name and argument count, opening to its parameters. */
function ToolRow({ tool }: { tool: Models.MCPTool }) {
  const [open, setOpen] = React.useState(false)
  const params = Object.entries(tool.input_schema?.properties ?? {})
  const required = new Set(tool.input_schema?.required ?? [])
  const id = React.useId()

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-accent/40 focus-visible:bg-accent/40 flex w-full items-center gap-3 px-3 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <ChevronRight
          className={cn(
            'text-ink-3 size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
            open && 'rotate-90'
          )}
        />
        <span className="grid min-w-0 flex-1 gap-px">
          <span className="truncate font-mono text-xs">{tool.name}</span>
          <span className="text-ink-3 text-[10.5px] leading-[14px]">
            {plural(params.length, 'param')} · {required.size} required
          </span>
        </span>
        <Badge
          variant="secondary"
          appearance="light"
          size="sm"
          aria-label={plural(params.length, 'parameter')}
        >
          {params.length}
        </Badge>
      </button>
      {open && (
        <div id={id} className="grid gap-3 px-3 pb-3 ps-10">
          {tool.description && (
            <p className="text-ink-2 max-w-prose text-[11.5px] leading-4 text-pretty">
              {tool.description}
            </p>
          )}
          {params.length > 0 && (
            <dl className="grid gap-2">
              {params.map(([name, schema]) => (
                <div key={name} className="grid gap-0.5">
                  <dt className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10.5px] leading-[14px]">{name}</span>
                    {schema.type && (
                      <span className="text-ink-3 text-[10.5px] leading-[14px]">
                        {[schema.type].flat().join(' | ')}
                      </span>
                    )}
                    {required.has(name) && (
                      <Badge variant="secondary" appearance="light" size="xs">
                        required
                      </Badge>
                    )}
                  </dt>
                  {schema.description && (
                    <dd className="text-ink-3 text-[11px] leading-[15px] text-pretty">
                      {schema.description}
                    </dd>
                  )}
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </li>
  )
}

/** What the row's faint line adds after the endpoint: its tool count and last sync. */
function ServerNote({ server }: { server: Models.MCPServer }) {
  return (
    <>
      {plural(server.tools.length, 'tool')}
      {' · '}
      {server.synced_at ? `synced ${timeAgo(new Date(server.synced_at))}` : 'never synced'}
      {!server.is_enabled && ' · Off'}
    </>
  )
}

/** One server: a row that opens to its actions, endpoint and tools. */
function ServerRow({
  server,
  organizationId,
  commandAllowed,
}: {
  server: Models.MCPServer
  organizationId: string
  commandAllowed: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openDelete, setOpenDelete] = React.useState(false)
  const test = useMutation(queries.mcpServers.test())
  const sync = useMutation(queries.mcpServers.sync())
  const toggle = useMutation(queries.mcpServers.update(server.id))
  const remove = useMutation(queries.mcpServers.delete())
  const oauthStart = useMutation(queries.mcpServers.oauthStart())
  const busy = test.isPending || sync.isPending || oauthStart.isPending
  const id = React.useId()
  // A command server is a super user's to change; anyone who may manage the
  // organization can still test, sync and remove it.
  const editable = server.kind !== 'command' || commandAllowed

  const endpoint =
    server.kind === 'command' ? [server.command, ...server.args].join(' ') : server.url

  const connect = () =>
    oauthStart.mutate(server.id, {
      onSuccess: ({ auth_url }) => window.location.assign(auth_url),
      onError: toastAxiosError,
    })

  const setEnabled = (on: boolean) =>
    toggle.mutate(
      {
        name: server.name,
        kind: server.kind,
        url: server.url || undefined,
        command: server.command || undefined,
        args: server.args,
        // Blank values keep the saved ones.
        headers: server.headers.map(({ name }) => ({ name, value: '' })),
        env: server.env.map(({ name }) => ({ name, value: '' })),
        is_enabled: on,
      },
      {
        onSuccess: () => toast.success(`${server.name} ${on ? 'on' : 'off'} for the assistant`),
        onError: toastAxiosError,
      }
    )

  return (
    <li>
      <div className="hover:border-input hover:bg-popover flex flex-wrap items-center gap-x-[11px] gap-y-2 rounded-[9px] border border-transparent px-2.5 py-[9px] transition-colors duration-150 motion-reduce:transition-none">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="focus-visible:ring-ring flex min-w-0 flex-1 basis-[calc(100%-40px)] items-center gap-[11px] rounded-[7px] text-start outline-none focus-visible:ring-2 focus-visible:ring-inset sm:basis-0"
        >
          <ChevronRight
            className={cn(
              'text-ink-3 size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
              open && 'rotate-90'
            )}
          />
          <span
            className={cn(
              'grid size-7 shrink-0 place-items-center rounded-[8px]',
              STATUS_LOOK[server.status].tile
            )}
          >
            <Plug className="size-[13px]" aria-hidden />
          </span>
          <span className="grid min-w-0 flex-1 gap-px">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-xs leading-4 font-semibold text-foreground">
                {server.name}
              </span>
              <span className="bg-muted text-ink-faint hidden shrink-0 rounded-[4px] px-[5px] py-px font-mono text-[8.5px] leading-3 font-semibold tracking-[0.4px] uppercase sm:inline">
                {KIND_LABELS[server.kind]}
              </span>
            </span>
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span
                title={endpoint}
                className="text-ink-3 min-w-0 truncate font-mono text-[10px] leading-[14px]"
              >
                {endpoint}
              </span>
              <span className="text-ink-faint hidden shrink-0 text-[10.5px] leading-[14px] sm:inline">
                · <ServerNote server={server} />
              </span>
            </span>
          </span>
        </button>
        <div className="flex shrink-0 basis-full items-center justify-end gap-2 sm:ms-auto sm:basis-auto">
          {/* The one action a broken sign-in needs, without opening the row. */}
          {!open && server.kind === 'hosted' && server.status === 'needs_auth' && (
            <Button
              variant="outline"
              className="bg-muted h-7 gap-1.5 rounded-sm px-2 text-[10.5px] font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-3"
              disabled={busy}
              onClick={connect}
            >
              <LogIn />
              Connect
            </Button>
          )}
          <StatusChip status={server.status} />
          <Switch
            size="sm"
            aria-label={`Offer ${server.name}'s tools to the assistant`}
            className="after:absolute after:-inset-3 after:content-['']"
            checked={server.is_enabled}
            disabled={toggle.isPending || !editable}
            onCheckedChange={setEnabled}
          />
        </div>
      </div>

      {open && (
        <div id={id} className="mt-1 grid gap-3 border-t px-3 pt-3 pb-3 sm:ps-10">
          <div className="-ms-2 flex flex-wrap gap-1">
            {server.kind === 'hosted' && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={connect}>
                <LogIn />
                {server.status === 'needs_auth' ? 'Connect' : 'Reconnect'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                test.mutate(server.id, {
                  onSuccess: ({ tool_count }) =>
                    toast.success(`${server.name} answered with ${plural(tool_count, 'tool')}`),
                  onError: toastAxiosError,
                })
              }
            >
              <Plug />
              {test.isPending ? 'Testing…' : 'Test connection'}
            </Button>
            {editable && (
              <Button variant="ghost" size="sm" onClick={() => setOpenEdit(true)}>
                <Pencil />
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                sync.mutate(server.id, {
                  onSuccess: ({ tool_count }) =>
                    toast.success(`${server.name}: ${plural(tool_count, 'tool')} synced`),
                  onError: toastAxiosError,
                })
              }
            >
              <RefreshCw
                className={cn(sync.isPending && 'animate-spin motion-reduce:animate-none')}
              />
              Sync tools
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setOpenDelete(true)}>
              <Trash2 />
              Delete
            </Button>
          </div>

          {server.status_message && server.status !== 'connected' && (
            <p
              className={cn(
                'text-[11.5px] leading-4',
                server.status === 'error' ? 'text-destructive' : 'text-ink-3'
              )}
            >
              {server.status_message}
            </p>
          )}

          {server.tools.length > 0 ? (
            <ul className="divide-border/60 overflow-hidden rounded-[8px] border border-border/60 divide-y">
              {server.tools.map((tool) => (
                <ToolRow key={tool.name} tool={tool} />
              ))}
            </ul>
          ) : (
            <p className="text-ink-3 text-[11.5px] leading-4">
              {server.status === 'connected'
                ? 'The server offers no tools.'
                : 'Its tools show here once it connects and syncs.'}
            </p>
          )}
        </div>
      )}

      <SimpleAlertDialog
        title={`Delete ${server.name}?`}
        description="The assistant loses its tools. Past conversations keep what the tools returned."
        open={openDelete}
        onOpenChange={setOpenDelete}
        onConfirm={() =>
          remove.mutate(server.id, {
            onSuccess: () => {
              toast.success(`${server.name} deleted`)
              setOpenDelete(false)
            },
            onError: toastAxiosError,
          })
        }
        confirmText="Delete"
        variant="destructive"
      />
      {/* Mounted while open, so the form starts from what is saved. */}
      {openEdit && (
        <MCPServerDialog
          open
          onOpenChange={setOpenEdit}
          organizationId={organizationId}
          server={server}
          commandAllowed={commandAllowed}
        />
      )}
    </li>
  )
}

/** Shaped like the rows it stands in for. */
function Loading() {
  return (
    <div className="grid gap-0.5">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-[11px] px-2.5 py-[9px]">
          <Skeleton className="size-7 rounded-[8px]" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="rounded-tag h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

/**
 * An organization's MCP servers: the endpoint every client points at, then each
 * server opening to its actions and the tools it offers the assistant chat.
 */
export default function MCPServerList({ organizationId }: { organizationId: string }) {
  const [openAdd, setOpenAdd] = React.useState(false)
  const { data, isPending, isError, error, refetch } = useQuery(
    queries.mcpServers.list(organizationId)
  )
  const servers = data?.data ?? []
  const commandAllowed = !!data?.metadata.command_allowed
  const connected = servers.filter((server) => server.status === 'connected').length

  return (
    <SettingsPage>
      <SectionHeading
        title="MCP"
        description="Model Context Protocol servers. Each one gets its own key and its own permissions."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        {/* The one value every client config needs, with the copy that saves typing it. */}
        <SettingsCard
          icon={Link2}
          tone="ai"
          body="form"
          title="Endpoint"
          description="Streamable HTTP only. Keys are scoped to this endpoint and can be revoked at any time."
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <code
              title={MCP_ENDPOINT}
              className="bg-canvas flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-[8px] border px-3 font-mono text-[11.5px]"
            >
              <span className="min-w-0 flex-1 truncate">{MCP_ENDPOINT}</span>
            </code>
            <Button
              variant="secondary"
              className="h-9 shrink-0 rounded-[8px] border border-border bg-muted px-3 text-[11.5px] font-semibold shadow-none"
              aria-label="Copy the MCP endpoint"
              onClick={() => copy(MCP_ENDPOINT, 'Endpoint')}
            >
              <Copy />
              Copy
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={Server}
          tone="ai"
          title="Registered servers"
          description="Their tools are offered to the assistant chat, never to automatic drafts"
          count={connected}
          noun={`of ${servers.length} connected`}
          action={
            <Button
              variant="outline"
              className="bg-muted h-7.5 gap-1.5 rounded-sm px-3 text-[11.5px] font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-3"
              onClick={() => setOpenAdd(true)}
            >
              <Plus />
              Add server
            </Button>
          }
          footer={
            <>
              <p className="text-ink-3 flex items-start gap-[5px] text-[10.5px] leading-[14px]">
                <Info className="mt-px size-[11px] shrink-0" aria-hidden />
                Servers authenticate with an API key you can revoke anytime
              </p>
              <Link
                to="/settings/api-keys"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-[5px] text-[10.5px] leading-[14px] font-semibold outline-none transition-colors duration-150 focus-visible:ring-[3px] motion-reduce:transition-none"
              >
                Create an API key
                <ArrowUpRight className="size-[11px]" aria-hidden />
              </Link>
            </>
          }
        >
          <QueryState
            isPending={isPending}
            isError={isError}
            error={error}
            onRetry={() => refetch()}
            isEmpty={servers.length === 0}
            loading={<Loading />}
            empty={
              <EmptyState
                title="No MCP servers yet"
                description="Add a server to give the assistant its tools: web search, your docs, your tickets, and so on."
                action={
                  <Button size="sm" onClick={() => setOpenAdd(true)}>
                    <Plus />
                    <span>Add server</span>
                  </Button>
                }
              />
            }
          >
            <ul className="grid gap-0.5">
              {servers.map((server) => (
                <ServerRow
                  key={server.id}
                  server={server}
                  organizationId={organizationId}
                  commandAllowed={commandAllowed}
                />
              ))}
            </ul>
          </QueryState>
        </SettingsCard>
      </div>

      {openAdd && (
        <MCPServerDialog
          open
          onOpenChange={setOpenAdd}
          organizationId={organizationId}
          commandAllowed={commandAllowed}
        />
      )}
    </SettingsPage>
  )
}
