import { useMutation } from '@tanstack/react-query'
import { Braces, Plug, Plus, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { MCPPair, MCPServerBody } from '@/lib/api/services/types/mcp-server'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const KINDS: {
  kind: Models.MCPServerKind
  label: string
  hint: string
  title: string
  description: string
}[] = [
  {
    kind: 'hosted',
    label: 'Hosted',
    hint: 'OAuth',
    title: 'Hosted server',
    description:
      "A remote server you sign in to with your account there. After adding it, you'll go to its sign-in page.",
  },
  {
    kind: 'http',
    label: 'HTTP',
    hint: 'Header',
    title: 'HTTP server',
    description:
      'A remote endpoint that takes an API key or another header, if it needs one at all.',
  },
  {
    kind: 'command',
    label: 'Command',
    hint: 'Local',
    title: 'Command server',
    description:
      'A program this server runs and talks to over stdio, such as npx or uvx. It runs on the server, so only a super user can add one.',
  },
]

const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/

/** "Exa Search" → "exa-search": the server's name as a slug. */
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|-+$/g, '')
    .slice(0, 32)

type Draft = {
  kind: Models.MCPServerKind
  name: string
  url: string
  headers: MCPPair[]
  command: string
  args: string
  env: MCPPair[]
}

const emptyDraft = (kind: Models.MCPServerKind): Draft => ({
  kind,
  name: '',
  url: '',
  headers: [],
  command: '',
  args: '',
  env: [],
})

const fromServer = (server: Models.MCPServer): Draft => ({
  kind: server.kind,
  name: server.name,
  url: server.url,
  // Saved values never come back: blank keeps them.
  headers: server.headers.map(({ name }) => ({ name, value: '' })),
  command: server.command,
  args: server.args.join('\n'),
  env: server.env.map(({ name }) => ({ name, value: '' })),
})

/** The body the API takes for a draft, one argument per non-empty line. */
function toBody(draft: Draft): MCPServerBody {
  const pairs = (list: MCPPair[]) =>
    list.filter((p) => p.name.trim()).map((p) => ({ ...p, name: p.name.trim() }))
  const base = { name: draft.name.trim(), kind: draft.kind }
  if (draft.kind === 'command') {
    return {
      ...base,
      command: draft.command.trim(),
      args: draft.args
        .split('\n')
        .map((arg) => arg.trim())
        .filter(Boolean),
      env: pairs(draft.env),
    }
  }
  return {
    ...base,
    url: draft.url.trim(),
    headers: draft.kind === 'http' ? pairs(draft.headers) : [],
  }
}

/** What's missing before the draft can be saved or tested, if anything. */
function draftError(draft: Draft) {
  if (!NAME_PATTERN.test(draft.name.trim()))
    return 'Name the server with lowercase letters, digits, - and _.'
  if (draft.kind === 'command')
    return draft.command.trim() ? undefined : 'Enter the command to run.'
  return /^https?:\/\/\S+$/.test(draft.url.trim()) ? undefined : 'Enter the server URL.'
}

/**
 * Reads a pasted MCP config: a Claude Desktop style { "mcpServers": { name:
 * {...} } } or one server object. Takes the first server.
 */
function parseImport(text: string): Draft {
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') throw new Error('Paste a JSON object.')
  let name = ''
  let entry = parsed as Record<string, unknown>
  const servers = (entry.mcpServers ?? entry.servers) as Record<string, unknown> | undefined
  if (servers && typeof servers === 'object') {
    const first = Object.entries(servers)[0]
    if (!first) throw new Error('The config lists no servers.')
    ;[name, entry] = [first[0], first[1] as Record<string, unknown>]
  }
  const pairs = (value: unknown): MCPPair[] =>
    value && typeof value === 'object'
      ? Object.entries(value as Record<string, unknown>).map(([key, val]) => ({
          name: key,
          value: String(val),
        }))
      : []
  if (typeof entry.command === 'string') {
    return {
      ...emptyDraft('command'),
      name: slugify(name),
      command: entry.command,
      args: Array.isArray(entry.args) ? entry.args.map(String).join('\n') : '',
      env: pairs(entry.env),
    }
  }
  const url =
    [entry.url, entry.serverUrl].find((value): value is string => typeof value === 'string') ?? ''
  if (!url) throw new Error('The server has neither a url nor a command.')
  const headers = pairs(entry.headers)
  return { ...emptyDraft(headers.length ? 'http' : 'hosted'), name: slugify(name), url, headers }
}

/** Header or environment rows: a name, a value, and a remove button each. */
function PairRows({
  label,
  pairs,
  onChange,
  namePlaceholder,
  valuePlaceholder,
  addLabel,
}: {
  label: string
  pairs: MCPPair[]
  onChange: (pairs: MCPPair[]) => void
  namePlaceholder: string
  valuePlaceholder: string
  addLabel: string
}) {
  const set = (index: number, patch: Partial<MCPPair>) =>
    onChange(pairs.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)))

  return (
    <Field>
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-muted-foreground text-xs">Optional</span>
      </div>
      {pairs.map((pair, index) => (
        // Rows have no id of their own; the position is the identity while editing.
        <div key={index} className="flex items-center gap-2">
          <Input
            aria-label={`${label} name`}
            className="font-mono text-xs"
            placeholder={namePlaceholder}
            value={pair.name}
            onChange={(e) => set(index, { name: e.target.value })}
          />
          <Input
            aria-label={`${label} value`}
            type="password"
            autoComplete="off"
            className="font-mono text-xs"
            placeholder={valuePlaceholder}
            value={pair.value}
            onChange={(e) => set(index, { value: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label={`Remove ${pair.name || label.toLowerCase()}`}
            onClick={() => onChange(pairs.filter((_, i) => i !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit self-start"
        onClick={() => onChange([...pairs, { name: '', value: '' }])}
      >
        <Plus />
        {addLabel}
      </Button>
    </Field>
  )
}

/**
 * Adds an MCP server, or edits one (its kind fixed). The left column picks
 * the kind or imports a pasted config; the right holds the kind's fields.
 */
export default function MCPServerDialog({
  open,
  onOpenChange,
  organizationId,
  server,
  commandAllowed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  server?: Models.MCPServer
  commandAllowed: boolean
}) {
  const [draft, setDraft] = React.useState<Draft>(() =>
    server ? fromServer(server) : emptyDraft('http')
  )
  const [importing, setImporting] = React.useState(false)
  const [importText, setImportText] = React.useState('')
  const [importError, setImportError] = React.useState<string>()
  const [nameTouched, setNameTouched] = React.useState(!!server)

  const create = useMutation(queries.mcpServers.create(organizationId))
  const update = useMutation(queries.mcpServers.update(server?.id ?? ''))
  const test = useMutation(queries.mcpServers.testDraft(organizationId))
  const oauthStart = useMutation(queries.mcpServers.oauthStart())
  const saving = create.isPending || update.isPending || oauthStart.isPending

  const kind = KINDS.find((k) => k.kind === draft.kind)!
  const error = draftError(draft)
  let submitLabel = 'Add server'
  if (saving) submitLabel = 'Saving…'
  else if (server) submitLabel = 'Save'
  else if (draft.kind === 'hosted') submitLabel = 'Add and sign in'
  const patch = (next: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...next }))
    test.reset()
  }

  // A name follows the URL's host until the user types one.
  const setURL = (url: string) => {
    let name = draft.name
    if (!nameTouched) {
      try {
        name = slugify(new URL(url).hostname.replace(/^(www|mcp|api)\./, '').split('.')[0] ?? '')
      } catch {
        // Not a URL yet; leave the name.
      }
    }
    patch({ url, name })
  }

  const runImport = () => {
    try {
      const next = parseImport(importText)
      if (next.kind === 'command' && !commandAllowed)
        throw new Error('This is a command server, which only a super user can add.')
      setDraft(next)
      setNameTouched(!!next.name)
      setImporting(false)
      setImportError(undefined)
    } catch (e) {
      setImportError(e instanceof SyntaxError ? "That isn't valid JSON." : (e as Error).message)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (error) return
    try {
      const body = toBody(draft)
      const saved = server ? await update.mutateAsync(body) : await create.mutateAsync(body)
      if (saved.kind === 'hosted' && saved.status === 'needs_auth') {
        // The sign-in returns to this page, which toasts how it went. The
        // server is saved either way, so a failed start closes the dialog
        // and leaves Connect on its row.
        try {
          const { auth_url } = await oauthStart.mutateAsync(saved.id)
          window.location.assign(auth_url)
        } catch (err) {
          toast.warning(
            `${saved.name} was saved, but its sign-in couldn't start: ${axiosErrorMessage(err)}`
          )
          onOpenChange(false)
        }
        return
      }
      if (saved.status === 'connected') {
        toast.success(`${saved.name}: ${saved.tools.length} tools synced`)
      } else if (saved.status === 'error') {
        toast.warning(`${saved.name} was saved, but: ${saved.status_message}`)
      } else {
        toast.success(`${saved.name} saved`)
      }
      onOpenChange(false)
    } catch (err) {
      toastAxiosError(err)
    }
  }

  let testResult: string | undefined
  if (test.isSuccess) {
    const { tool_count: count, tools = [] } = test.data
    const more = tools.length > 4 ? ', …' : ''
    const names = tools.length ? ` (${tools.slice(0, 4).join(', ')}${more})` : ''
    testResult = `Connected: ${count} ${count === 1 ? 'tool' : 'tools'}${names}.`
  } else if (test.isError) {
    testResult = axiosErrorMessage(test.error)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <form
          onSubmit={submit}
          className="grid min-h-0 sm:min-h-[30rem] sm:grid-cols-[13rem_minmax(0,1fr)]"
        >
          <nav
            aria-label="Server kind"
            className="bg-muted/40 flex flex-col gap-1 border-b p-4 sm:border-e sm:border-b-0"
          >
            <DialogTitle className="mb-3 text-base">
              {server ? `Edit ${server.name}` : 'Add MCP server'}
            </DialogTitle>
            {!server && (
              <p className="text-muted-foreground mb-1 px-2 text-xs font-medium uppercase">New</p>
            )}
            <div className="flex gap-1 overflow-x-auto sm:flex-col">
              {KINDS.filter((k) => !server || k.kind === server.kind).map((k) => {
                const locked = k.kind === 'command' && !commandAllowed && !server
                const active = !importing && draft.kind === k.kind
                return (
                  <button
                    key={k.kind}
                    type="button"
                    disabled={locked || !!server}
                    aria-pressed={active}
                    title={locked ? 'Only a super user can add a command server' : undefined}
                    onClick={() => {
                      setImporting(false)
                      patch({ kind: k.kind })
                    }}
                    className={cn(
                      'flex shrink-0 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-start text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed',
                      active ? 'bg-background font-medium shadow-xs' : 'hover:bg-accent/60',
                      locked && 'opacity-50'
                    )}
                  >
                    {k.label}
                    <span className="text-muted-foreground text-xs font-normal">{k.hint}</span>
                  </button>
                )
              })}
            </div>
            {!server && (
              <button
                type="button"
                aria-pressed={importing}
                onClick={() => setImporting((on) => !on)}
                className={cn(
                  'text-muted-foreground hover:text-foreground mt-auto hidden w-fit items-center gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:flex',
                  importing && 'text-foreground'
                )}
              >
                <Braces className="size-4" />
                Import JSON
              </button>
            )}
          </nav>

          <div className="flex min-h-0 flex-col overflow-y-auto">
            {importing ? (
              <div className="grid flex-1 content-start gap-4 p-6">
                <div className="grid gap-1 pe-8">
                  <h3 className="font-semibold">Import JSON</h3>
                  <DialogDescription>
                    Paste a server&apos;s config, such as an entry of a client&apos;s
                    &quot;mcpServers&quot;. The first server fills in the form.
                  </DialogDescription>
                </div>
                <Textarea
                  aria-label="Server config JSON"
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={
                    '{\n  "mcpServers": {\n    "exa": { "url": "https://mcp.exa.ai/mcp" }\n  }\n}'
                  }
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                {importError && (
                  <p role="alert" className="text-destructive text-sm">
                    {importError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setImporting(false)}>
                    Back
                  </Button>
                  <Button type="button" disabled={!importText.trim()} onClick={runImport}>
                    Fill in the form
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid flex-1 content-start gap-5 p-6">
                  <div className="grid gap-1 pe-8">
                    <h3 className="font-semibold">{kind.title}</h3>
                    <DialogDescription>{kind.description}</DialogDescription>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="mcp-name">Name</FieldLabel>
                    <Input
                      id="mcp-name"
                      placeholder="server-name"
                      autoComplete="off"
                      className="font-mono"
                      maxLength={32}
                      value={draft.name}
                      onChange={(e) => {
                        setNameTouched(true)
                        patch({ name: e.target.value.toLowerCase() })
                      }}
                    />
                    <FieldDescription>
                      Lowercase letters, digits, - and _. The assistant sees tools as mcp__
                      {draft.name || 'name'}__tool.
                    </FieldDescription>
                  </Field>

                  {draft.kind === 'command' ? (
                    <>
                      <Field>
                        <FieldLabel htmlFor="mcp-command">Command</FieldLabel>
                        <Input
                          id="mcp-command"
                          placeholder="npx"
                          autoComplete="off"
                          className="font-mono"
                          value={draft.command}
                          onChange={(e) => patch({ command: e.target.value })}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="mcp-args">Arguments</FieldLabel>
                        <Textarea
                          id="mcp-args"
                          rows={3}
                          className="font-mono text-xs"
                          placeholder={'-y\n@modelcontextprotocol/server-everything'}
                          value={draft.args}
                          onChange={(e) => patch({ args: e.target.value })}
                        />
                        <FieldDescription>One argument per line.</FieldDescription>
                      </Field>
                      <PairRows
                        label="Environment"
                        pairs={draft.env}
                        onChange={(env) => patch({ env })}
                        namePlaceholder="API_KEY"
                        valuePlaceholder={server ? 'Saved; leave empty to keep it' : 'value'}
                        addLabel="Add variable"
                      />
                    </>
                  ) : (
                    <>
                      <Field>
                        <FieldLabel htmlFor="mcp-url">URL</FieldLabel>
                        <Input
                          id="mcp-url"
                          inputMode="url"
                          autoComplete="off"
                          className="font-mono"
                          placeholder="https://example.com/mcp"
                          value={draft.url}
                          onChange={(e) => setURL(e.target.value)}
                        />
                      </Field>
                      {draft.kind === 'http' && (
                        <PairRows
                          label="Headers"
                          pairs={draft.headers}
                          onChange={(headers) => patch({ headers })}
                          namePlaceholder="Authorization"
                          valuePlaceholder={
                            server ? 'Saved; leave empty to keep it' : 'Bearer token'
                          }
                          addLabel="Add header"
                        />
                      )}
                    </>
                  )}

                  {testResult && (
                    <p
                      role="status"
                      className={cn(
                        'text-sm',
                        test.isError ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {testResult}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t p-4">
                  {draft.kind !== 'hosted' && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!!error || test.isPending}
                      onClick={() => test.mutate({ ...toBody(draft), id: server?.id })}
                    >
                      <Plug />
                      {test.isPending ? 'Testing…' : 'Test connection'}
                    </Button>
                  )}
                  <div className="ms-auto flex gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!!error || saving} title={error}>
                      {submitLabel}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
