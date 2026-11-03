import { useMutation, useQuery } from '@tanstack/react-query'
import { Copy, KeyRound, Link, Plug, Plus, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import QueryState from '@/components/block/common/query-state'
import SectionHeading from '@/components/block/common/section-heading'
import { SettingsCard, SettingsPage } from '@/components/block/common/settings-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { toastAxiosError } from '@/lib/api/axios-error'
import { parseDto } from '@/lib/api/dtos/parse'
import {
  API_KEY_LIFETIMES,
  APIKeySchema,
  GLOBAL_SCOPE,
} from '@/lib/api/dtos/settings/api-key/schema'
import { queries } from '@/lib/api/queries'
import { MCP_ENDPOINT } from '@/lib/constants/mcp'
import { isPast, timeAgo } from '@/lib/date'

const LIFETIME_OPTIONS = API_KEY_LIFETIMES.map((days) => ({
  value: days,
  label: days === '365' ? '1 year' : `${days} days`,
}))

/** The block an MCP host's config file takes, Claude Desktop's and Cursor's shape. */
const clientConfig = (key: string) =>
  JSON.stringify(
    {
      mcpServers: {
        'montara-mail': {
          type: 'http',
          url: MCP_ENDPOINT,
          headers: { Authorization: `Bearer ${key}` },
        },
      },
    },
    null,
    2
  )

const copy = (text: string, what: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error(`Couldn't copy the ${what.toLowerCase()}; select it instead.`)
  )

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** "Created 29 Oct 2026 · Expires 27 Jan 2027 · Used 3 hours ago". */
function KeyMeta({ apiKey }: { apiKey: Models.APIKey }) {
  const expired = !!apiKey.expires_at && isPast(new Date(apiKey.expires_at))
  return (
    <span className="text-ink-3 text-[10.5px] leading-[14px]">
      Created {day(apiKey.created_at)}
      {apiKey.expires_at && (
        <span className={expired ? 'text-destructive' : undefined}>
          {' · '}
          {expired ? 'Expired' : 'Expires'} {day(apiKey.expires_at)}
        </span>
      )}
      {' · '}
      {apiKey.last_used_at ? `Used ${timeAgo(new Date(apiKey.last_used_at))}` : 'Never used'}
    </span>
  )
}

function KeyRow({ apiKey }: { apiKey: Models.APIKey }) {
  const [confirming, setConfirming] = React.useState(false)
  const remove = useMutation(queries.apiKeys.delete())

  return (
    <li className="flex flex-wrap items-center gap-3 px-[18px] py-3">
      <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-[8px]">
        <KeyRound className="text-muted-foreground size-[13px]" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="text-[12.5px] leading-[17px] font-semibold wrap-anywhere">
            {apiKey.name}
          </span>
          <span className="text-ink-3 font-mono text-[10.5px]">{apiKey.hint}</span>
          <Badge variant="secondary" appearance="light" size="sm" className="max-w-48">
            <span className="truncate">
              {apiKey.organization_id
                ? apiKey.organization_name || 'Deleted organization'
                : 'All organizations'}
            </span>
          </Badge>
          {apiKey.read_only && (
            <Badge variant="info" appearance="light" size="sm">
              Read only
            </Badge>
          )}
        </span>
        <KeyMeta apiKey={apiKey} />
      </span>
      <Button
        variant="destructive"
        mode="icon"
        size="sm"
        aria-label={`Revoke ${apiKey.name}`}
        disabled={remove.isPending}
        onClick={() => setConfirming(true)}
      >
        <Trash2 />
      </Button>

      <SimpleAlertDialog
        title={`Revoke ${apiKey.name}?`}
        description="Apps using this key lose access to your mailboxes at once. This cannot be undone."
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() =>
          remove.mutate(apiKey.id, {
            onSuccess: () => {
              toast.success(`${apiKey.name} revoked`)
              setConfirming(false)
            },
            onError: toastAxiosError,
          })
        }
        confirmText="Revoke"
        variant="destructive"
      />
    </li>
  )
}

function CreateKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (created: Models.CreatedAPIKey) => void
}) {
  const create = useMutation(queries.apiKeys.create())
  // The organizations the switcher lists: every one for a super user.
  const { organization, organizations } = useActiveOrganization()
  const scopeOptions = [
    { value: GLOBAL_SCOPE, label: 'All organizations' },
    ...organizations.map((org) => ({ value: org.id, label: org.name })),
  ]
  const form = useAppForm({
    // The narrower choice by default: the organization open now.
    defaultValues: {
      name: '',
      expires_in_days: '90' as (typeof API_KEY_LIFETIMES)[number],
      scope: organization?.id ?? GLOBAL_SCOPE,
      permission: 'read' as 'read' | 'act',
    },
    validators: { onSubmit: APIKeySchema, onChange: APIKeySchema },
    onSubmit: async ({ value }) => {
      const dto = parseDto(APIKeySchema, value)
      try {
        onCreated(
          await create.mutateAsync({
            name: dto.name.trim(),
            expires_in_days: Number(dto.expires_in_days),
            organization_id: dto.scope === GLOBAL_SCOPE ? undefined : dto.scope,
            read_only: dto.permission === 'read',
          })
        )
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <SimpleAlertScrollableDialogForm
      open
      onOpenChange={(open) => !open && onClose()}
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      title="Create API key"
      description="For one app, so you can revoke it alone."
      confirmText="Create key"
      loading={create.isPending}
      size="md"
    >
      <div className="grid gap-4">
        <form.AppField
          name="name"
          children={(field) => (
            <field.TextField asterisk label="Name" placeholder="Claude Desktop on my laptop" />
          )}
        />
        <div className="grid gap-2">
          <form.AppField
            name="scope"
            children={(field) => <field.SelectField label="Access" options={scopeOptions} />}
          />
          <FieldDescription>
            One organization's mailboxes, or every organization you can open, including ones added
            later. Give each app only what it needs.
          </FieldDescription>
        </div>
        <div className="grid gap-2">
          <form.AppField
            name="permission"
            children={(field) => (
              <field.SelectField
                label="Can"
                options={[
                  { value: 'read', label: 'Read mail only' },
                  { value: 'act', label: 'Read, organize and propose replies' },
                ]}
              />
            )}
          />
          <FieldDescription>
            Read only is safest: an email can carry text written to steer an AI. Organizing moves
            and labels mail at once; proposals still wait for your approval.
          </FieldDescription>
        </div>
        <form.AppField
          name="expires_in_days"
          children={(field) => (
            <field.SelectField label="Expires after" options={LIFETIME_OPTIONS} />
          )}
        />
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}

/** The new key, once: the server keeps only its hash. */
function KeyCreatedDialog({
  created,
  onClose,
}: {
  created: Models.CreatedAPIKey
  onClose: () => void
}) {
  const config = clientConfig(created.key)
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{created.api_key.name} is ready</AlertDialogTitle>
          <AlertDialogDescription>
            Copy the key now. It is not shown again; if you lose it, revoke it and create another.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid min-w-0 gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <code className="bg-muted/60 min-w-0 flex-1 truncate rounded-md border px-3 py-2 font-mono text-sm select-all">
              {created.key}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copy(created.key, 'Key')}
            >
              <Copy />
              Copy
            </Button>
          </div>
          <div className="grid min-w-0 gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Client config</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => copy(config, 'Config')}
              >
                <Copy />
                Copy
              </Button>
            </div>
            <pre className="bg-muted/60 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
              {config}
            </pre>
            <p className="text-ink-3 text-xs text-pretty">
              Add it to your MCP client's servers, e.g. Claude Desktop's or Cursor's{' '}
              <code className="font-mono">mcp.json</code>.
            </p>
          </div>
        </div>
        <AlertDialogFooter>
          <Button onClick={onClose}>Done</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Shaped like the rows it stands in for. */
function Loading() {
  return (
    <div className="grid gap-5 py-3">
      {[0, 1].map((index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-4 rounded" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A group's label, above its card. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-ink-faint font-mono text-[10.5px] leading-[13px] font-semibold tracking-[1px] uppercase">
      {children}
    </p>
  )
}

/**
 * The user's API keys, which let MCP clients outside the app reach their
 * mailboxes through /mcp.
 */
export default function APIKeyList() {
  const [creating, setCreating] = React.useState(false)
  const [created, setCreated] = React.useState<Models.CreatedAPIKey | null>(null)
  const { data: keys = [], isPending, isError, error, refetch } = useQuery(queries.apiKeys.list())

  return (
    <SettingsPage>
      <SectionHeading
        title="API Keys"
        description="Let MCP clients such as Claude Desktop or Cursor search and sort your mail. Anything they propose to send waits for your approval."
      />

      <div className="grid gap-5">
        <GroupLabel>Connection</GroupLabel>
        <SettingsCard icon={Plug} tone="info" body="form" title="MCP endpoint">
          <div className="flex min-w-0 items-center gap-2.5">
            <code
              title={MCP_ENDPOINT}
              className="bg-background text-foreground flex h-9.5 min-w-0 flex-1 items-center gap-2 rounded-md border px-3 font-mono text-xs"
            >
              <Link className="text-ink-3 size-[13px] shrink-0" aria-hidden />
              <span className="truncate">{MCP_ENDPOINT}</span>
            </code>
            <Button
              variant="outline"
              className="bg-muted h-9.5 gap-1.5 px-3 text-xs font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-[13px]"
              onClick={() => copy(MCP_ENDPOINT, 'Endpoint')}
            >
              <Copy />
              Copy
            </Button>
          </div>
          <p className="text-ink-3 text-[11px] leading-[15px] text-pretty">
            Streamable HTTP. Send a key as Authorization: Bearer. It opens this endpoint only, never
            your account.
          </p>
        </SettingsCard>

        <GroupLabel>Keys</GroupLabel>
        <SettingsCard
          icon={KeyRound}
          tone="info"
          body="form"
          title="Active keys"
          description="One key per app, so you can revoke each one alone."
          action={
            <Button
              variant="outline"
              className="bg-muted h-7.5 gap-1.5 px-3 text-[11.5px] font-semibold shadow-none pointer-coarse:h-11 [&_svg]:size-3"
              onClick={() => setCreating(true)}
            >
              <Plus />
              Create key
            </Button>
          }
        >
          <QueryState
            isPending={isPending}
            isError={isError}
            error={error}
            onRetry={() => refetch()}
            isEmpty={keys.length === 0}
            loading={<Loading />}
            empty={
              <div className="grid justify-items-center gap-2 py-6 text-center">
                <span className="bg-muted grid size-9 place-items-center rounded-[10px]">
                  <KeyRound className="text-ink-3 size-4" aria-hidden />
                </span>
                <p className="text-[12.5px] leading-[17px] font-semibold">No API keys yet</p>
                <p className="text-ink-3 text-[11px] leading-[15px]">
                  Create one for each app you connect, so you can revoke it alone.
                </p>
              </div>
            }
          >
            <ul className="divide-border/60 -m-[18px] divide-y overflow-hidden rounded-b-lg">
              {keys.map((apiKey) => (
                <KeyRow key={apiKey.id} apiKey={apiKey} />
              ))}
            </ul>
          </QueryState>
        </SettingsCard>
      </div>

      {creating && (
        <CreateKeyDialog
          onClose={() => setCreating(false)}
          onCreated={(next) => {
            setCreating(false)
            setCreated(next)
          }}
        />
      )}
      {created && <KeyCreatedDialog created={created} onClose={() => setCreated(null)} />}
    </SettingsPage>
  )
}
