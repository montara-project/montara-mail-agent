import { IconPlus } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronRight, LogIn, Pencil, Plug, RefreshCw, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import EmptyState from '@/components/block/common/empty-state'
import SectionCard from '@/components/block/common/section-card'
import SectionHeading from '@/components/block/common/section-heading'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import MCPServerDialog from '@/components/block/mcp/mcp-server-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const KIND_LABELS: Record<Models.MCPServerKind, string> = {
  hosted: 'Hosted',
  http: 'HTTP',
  command: 'Command',
}

const STATUS_LABELS: Record<Models.MCPServerStatus, string> = {
  pending: 'Not synced',
  connected: 'Connected',
  needs_auth: 'Needs sign-in',
  error: 'Error',
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "2 tools · Connected", the status coloured when it needs attention. */
function ServerSummary({ server }: { server: Models.MCPServer }) {
  return (
    <span className="text-muted-foreground text-xs">
      {plural(server.tools.length, 'tool')} ·{' '}
      <span
        className={cn(
          server.status === 'error' && 'text-destructive',
          server.status === 'needs_auth' && 'text-amber-600 dark:text-amber-400'
        )}
      >
        {STATUS_LABELS[server.status]}
      </span>
      {!server.is_enabled && ' · Off'}
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
        className="hover:bg-accent/40 flex w-full items-center gap-3 px-3 py-2.5 text-start outline-none focus-visible:bg-accent/40"
      >
        <ChevronRight
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            open && 'rotate-90'
          )}
        />
        <span className="grid min-w-0 flex-1">
          <span className="truncate font-mono text-sm">{tool.name}</span>
          <span className="text-muted-foreground text-xs">
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
            <p className="text-muted-foreground max-w-prose text-sm text-pretty">
              {tool.description}
            </p>
          )}
          {params.length > 0 && (
            <dl className="grid gap-2 text-sm">
              {params.map(([name, schema]) => (
                <div key={name} className="grid gap-0.5">
                  <dt className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{name}</span>
                    {schema.type && (
                      <span className="text-muted-foreground text-xs">
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
                    <dd className="text-muted-foreground text-xs text-pretty">
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
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 text-start outline-none focus-visible:underline"
        >
          <ChevronRight
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform motion-reduce:transition-none',
              open && 'rotate-90'
            )}
          />
          <span className="grid min-w-0">
            <span className="truncate text-sm font-medium">{server.name}</span>
            <ServerSummary server={server} />
          </span>
        </button>
        <Badge variant="secondary" appearance="light" className="hidden sm:inline-flex">
          {KIND_LABELS[server.kind]}
        </Badge>
        <Switch
          size="sm"
          aria-label={`Offer ${server.name}'s tools to the assistant`}
          className="after:absolute after:-inset-3 after:content-['']"
          checked={server.is_enabled}
          disabled={toggle.isPending || !editable}
          onCheckedChange={setEnabled}
        />
      </div>

      {open && (
        <div id={id} className="grid gap-3 border-t px-4 py-3 sm:ps-11">
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
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setOpenDelete(true)}
            >
              <Trash2 />
              Delete
            </Button>
          </div>

          <p className="text-muted-foreground font-mono text-xs break-all">{endpoint}</p>
          {server.status_message && server.status !== 'connected' && (
            <p
              className={cn(
                'text-sm',
                server.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {server.status_message}
            </p>
          )}

          {server.tools.length > 0 ? (
            <ul className="divide-y overflow-hidden rounded-lg border">
              {server.tools.map((tool) => (
                <ToolRow key={tool.name} tool={tool} />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
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
    <div className="grid gap-5 py-3">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-4 rounded" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * An organization's MCP servers: each opens to its actions and the tools it
 * offers the assistant chat.
 */
export default function MCPServerList({ organizationId }: { organizationId: string }) {
  const [openAdd, setOpenAdd] = React.useState(false)
  const { data, isPending, isError, error, refetch } = useQuery(
    queries.mcpServers.list(organizationId)
  )
  const servers = data?.data ?? []
  const commandAllowed = !!data?.metadata.command_allowed

  return (
    <section className="grid gap-3">
      <SectionHeading
        title="MCP servers"
        description={
          isPending
            ? 'Tools from outside servers, offered to the assistant chat.'
            : `${servers.length} registered. Their tools are offered to the assistant chat, never to automatic drafts.`
        }
        action={
          <Button className="h-8.5 rounded-lg" onClick={() => setOpenAdd(true)}>
            <IconPlus />
            <span>Add server</span>
          </Button>
        }
      />
      <SectionCard>
        {isPending ? (
          <Loading />
        ) : isError ? (
          <div role="alert" className="grid justify-items-center gap-3 p-6 text-center text-sm">
            <p className="text-destructive">{axiosErrorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw />
              Try again
            </Button>
          </div>
        ) : servers.length === 0 ? (
          <EmptyState
            title="No MCP servers yet"
            description="Add a server to give the assistant its tools: web search, your docs, your tickets, and so on."
          />
        ) : (
          <ul className="-m-4 divide-y overflow-hidden rounded-lg">
            {servers.map((server) => (
              <ServerRow
                key={server.id}
                server={server}
                organizationId={organizationId}
                commandAllowed={commandAllowed}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      {openAdd && (
        <MCPServerDialog
          open
          onOpenChange={setOpenAdd}
          organizationId={organizationId}
          commandAllowed={commandAllowed}
        />
      )}
    </section>
  )
}
