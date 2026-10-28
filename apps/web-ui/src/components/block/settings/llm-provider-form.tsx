import { IconPlus } from '@tabler/icons-react'
import { useStore } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Building2, Check, Globe, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type {
  LLMModelsBody,
  LLMProviderListResponse,
  LLMProviderScope,
} from '@/lib/api/services/types/llm-provider'

import EmptyState from '@/components/block/common/empty-state'
import Hint from '@/components/block/common/hint'
import SectionCard from '@/components/block/common/section-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { useDebounce } from '@/hooks/use-debounce'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { parseDto } from '@/lib/api/dtos/parse'
import { LLMProviderFormSchema } from '@/lib/api/dtos/settings/llm-provider/schema'
import { queries } from '@/lib/api/queries'

const KIND_OPTIONS: { value: Models.LLMProviderKind; label: string }[] = [
  { value: 'openai', label: 'OpenAI compatible' },
  { value: 'anthropic', label: 'Anthropic compatible' },
]

const PLACEHOLDERS: Record<'openai' | 'anthropic', { baseURL: string; model: string }> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'e.g. gpt-5-mini' },
  anthropic: { baseURL: 'https://api.anthropic.com', model: 'e.g. claude-sonnet-5-5' },
}

/** The select's value for the global scope; organization ids fill the rest. */
const GLOBAL = 'global'
const toScope = (value: string): LLMProviderScope => (value === GLOBAL ? null : value)

/** What the list calls a provider: its name, else its host, else its format. */
function providerName(provider: Models.LLMProvider) {
  if (provider.name) return provider.name
  try {
    if (provider.base_url) return new URL(provider.base_url).host
  } catch {
    // Not a URL; fall through to the format.
  }
  if (provider.kind === 'self_hosted') return 'Self-hosted'
  return provider.kind === 'anthropic' ? 'Anthropic' : 'OpenAI'
}

/** The endpoint a provider calls, the vendor's own when its base URL is empty. */
function providerEndpoint(provider: Models.LLMProvider) {
  return (
    provider.base_url ||
    PLACEHOLDERS[provider.kind === 'anthropic' ? 'anthropic' : 'openai'].baseURL
  )
}

/** Whether the saved provider's key is the one the form would use: same kind and base URL. */
function keyIsSaved(provider: Models.LLMProvider | undefined, kind: string, baseURL: string) {
  return !!provider?.has_api_key && provider.kind === kind && provider.base_url === baseURL.trim()
}

/**
 * The models the provider in the form offers, fetched again once its kind,
 * base URL and key have settled, so the model list follows the form.
 */
function useProviderModels(scope: LLMProviderScope, body: LLMModelsBody, ready: boolean) {
  // A string, so the debounce sees a change only when a value changes.
  const settled = useDebounce({ value: JSON.stringify(body), delay: 600 })
  const current = settled === JSON.stringify(body)
  return useQuery(queries.llmProvider.models(scope, JSON.parse(settled), ready && current))
}

/** Below the model field: how loading the provider's models went, with a retry. */
function ModelStatus({
  models,
  idleHint,
}: {
  models: ReturnType<typeof useProviderModels>
  /** Shown while the form lacks what the list needs, e.g. the key. */
  idleHint: string
}) {
  const { data, isFetching, isError, error, refetch, fetchStatus, isPending } = models
  const idle = isPending && fetchStatus === 'idle'

  return (
    <div className="-mt-2 flex items-center gap-2" aria-live="polite">
      <FieldDescription className={isError ? 'text-destructive' : undefined}>
        {idle
          ? idleHint
          : isFetching
            ? 'Loading the models...'
            : isError
              ? axiosErrorMessage(error)
              : data?.length
                ? `${data.length} models found.`
                : 'The provider listed no models; type the id.'}
      </FieldDescription>
      {!idle && !isFetching && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => refetch()}
          aria-label="Load the models again"
        >
          <RefreshCw />
          {isError ? 'Retry' : 'Refresh'}
        </Button>
      )}
    </div>
  )
}

/** A scope the user can pick, and whether it is taken by another provider. */
type ScopeOption = { value: string; label: string; disabled: boolean }

/**
 * Adds a provider, or edits one in place. Adding picks where it runs; an
 * edited provider keeps its scope (the row's scope action moves it).
 */
function ProviderDialog({
  open,
  onOpenChange,
  provider,
  scopeOptions,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: Models.LLMProviderListed
  scopeOptions: ScopeOption[]
}) {
  const [picked, setPicked] = React.useState(
    () => scopeOptions.find((option) => !option.disabled)?.value ?? ''
  )
  const scopeValue = provider ? (provider.organization_id ?? GLOBAL) : picked
  const scope = toScope(scopeValue)
  const save = useMutation(queries.llmProvider.save(scope))
  // A self-hosted model's fields don't fit this form; editing it starts empty.
  const own = provider && provider.kind !== 'self_hosted' ? provider : undefined

  const form = useAppForm({
    defaultValues: {
      name: provider?.name ?? '',
      kind: own?.kind ?? 'openai',
      base_url: own?.base_url ?? '',
      model: own?.model ?? '',
      api_key: '',
    },
    validators: { onSubmit: LLMProviderFormSchema, onChange: LLMProviderFormSchema },
    onSubmit: async ({ value }) => {
      try {
        await save.mutateAsync(parseDto(LLMProviderFormSchema, value))
        toast.success(provider ? 'AI provider updated' : 'AI provider added')
        onOpenChange(false)
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })
  const { kind, base_url, api_key, model } = useStore(form.store, (state) => state.values)
  const saved = keyIsSaved(own, kind, base_url)
  const models = useProviderModels(
    scope,
    { kind, base_url: base_url.trim(), api_key: api_key.trim() },
    !!scopeValue && (saved || api_key.trim() !== '')
  )
  const placeholders = PLACEHOLDERS[kind === 'anthropic' ? 'anthropic' : 'openai']
  // Once the provider lists its models, the field is a select of them (the
  // chosen one kept even when the list lacks it); until then, or when the
  // list fails or is empty, the id is typed.
  const modelOptions = models.data?.length
    ? [...new Set([...(model ? [model] : []), ...models.data])].map((id) => ({
        value: id,
        label: id,
      }))
    : undefined

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title={provider ? `Edit ${providerName(provider)}` : 'Add AI provider'}
      confirmText={provider ? 'Update' : 'Save'}
      loading={save.isPending}
      disabled={!scopeValue}
    >
      {provider?.kind === 'self_hosted' && (
        <p role="note" className="rounded-lg border border-amber-500/40 p-3 text-sm">
          A self-hosted model ({provider.model}) is in use. Saving here replaces it.
        </p>
      )}
      {!provider && (
        <Field>
          <FieldLabel htmlFor="llm-provider-scope">Runs in</FieldLabel>
          <Select value={picked} onValueChange={setPicked} indicatorPosition="right">
            <SelectTrigger id="llm-provider-scope" className="h-10">
              <SelectValue placeholder="Every scope already has a provider" />
            </SelectTrigger>
            <SelectContent position="popper">
              {scopeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            Global runs in every organization that has no provider of its own.
          </FieldDescription>
        </Field>
      )}
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField label="Name" placeholder="e.g. Tera Router" maxLength={100} />
        )}
      />
      <form.AppField
        name="kind"
        children={(field) => (
          <field.SelectField asterisk label="API format" options={KIND_OPTIONS} />
        )}
      />
      <form.AppField
        name="base_url"
        children={(field) => (
          <field.TextField label="Base URL" placeholder={placeholders.baseURL} inputMode="url" />
        )}
      />
      <FieldDescription>
        Leave empty for the vendor's own API. Any compatible server works: OpenRouter, Groq, a
        LiteLLM proxy, and so on.
      </FieldDescription>
      <form.AppField
        name="api_key"
        children={(field) => (
          <field.PasswordField
            asterisk={!saved}
            label="API key"
            placeholder={saved ? 'Saved; leave empty to keep it' : 'Paste the API key'}
          />
        )}
      />
      <form.AppField
        name="model"
        children={(field) =>
          modelOptions ? (
            <field.SelectField
              asterisk
              label="Model"
              placeholder="Pick a model"
              options={modelOptions}
            />
          ) : (
            <field.TextField
              asterisk
              label="Model"
              placeholder={placeholders.model}
              autoComplete="off"
            />
          )
        }
      />
      <ModelStatus models={models} idleHint="Enter the API key to load the provider's models." />
    </SimpleAlertScrollableDialogForm>
  )
}

/** One provider: what it calls, where it runs, and its actions. */
function ProviderRow({
  provider,
  scopeOptions,
}: {
  provider: Models.LLMProviderListed
  scopeOptions: ScopeOption[]
}) {
  const [openEdit, setOpenEdit] = React.useState(false)
  const [openDelete, setOpenDelete] = React.useState(false)
  const remove = useMutation(queries.llmProvider.delete())
  const move = useMutation(queries.llmProvider.setScope())
  const current = provider.organization_id ?? GLOBAL

  const moveTo = (option: ScopeOption) =>
    move.mutate(
      { id: provider.id, scope: toScope(option.value) },
      {
        onSuccess: () => toast.success(`${providerName(provider)} now runs in ${option.label}`),
        onError: toastAxiosError,
      }
    )

  return (
    <tr className="border-t">
      <td className="py-3 pr-4 font-medium">{providerName(provider)}</td>
      <td className="text-muted-foreground max-w-56 truncate py-3 pr-4 font-mono text-xs">
        {providerEndpoint(provider)}
      </td>
      <td className="text-muted-foreground py-3 pr-4">{provider.model}</td>
      <td className="py-3 pr-4">
        <Badge variant="secondary" appearance="light">
          {provider.organization_id ? provider.organization_name : 'Global'}
        </Badge>
      </td>
      <td className="py-3">
        <div className="flex justify-end gap-0.5">
          <Hint label="Edit">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Edit"
              onClick={() => setOpenEdit(true)}
            >
              <Pencil />
            </Button>
          </Hint>
          <DropdownMenu>
            <Hint label="Where it runs">
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Where it runs"
                  disabled={move.isPending}
                >
                  {provider.organization_id ? <Building2 /> : <Globe />}
                </Button>
              </DropdownMenuTrigger>
            </Hint>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Runs in
              </DropdownMenuLabel>
              {scopeOptions.map((option, index) => (
                <React.Fragment key={option.value}>
                  {index === 1 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    disabled={option.value === current || option.disabled}
                    onSelect={() => moveTo(option)}
                  >
                    {option.value === GLOBAL ? <Globe /> : <Building2 />}
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.value === current && <Check />}
                  </DropdownMenuItem>
                </React.Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Hint label="Delete">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Delete"
              onClick={() => setOpenDelete(true)}
            >
              <Trash2 />
            </Button>
          </Hint>
        </div>

        <SimpleAlertDialog
          title={`Delete ${providerName(provider)}?`}
          description={
            provider.organization_id
              ? `${provider.organization_name} falls back to the global provider, or the server's model.`
              : "Organizations without their own provider fall back to the server's model."
          }
          open={openDelete}
          onOpenChange={setOpenDelete}
          onConfirm={() =>
            remove.mutate(provider.organization_id, {
              onSuccess: () => {
                toast.success('AI provider deleted')
                setOpenDelete(false)
              },
              onError: toastAxiosError,
            })
          }
          confirmText="Delete"
          variant="destructive"
        />
        {/* Mounted while open, so the form starts from what is stored. */}
        {openEdit && (
          <ProviderDialog
            open
            onOpenChange={setOpenEdit}
            provider={provider}
            scopeOptions={scopeOptions}
          />
        )}
      </td>
    </tr>
  )
}

/** One line on the provider the active organization's AI features call now. */
function providerStatus(organization?: Models.Organization, data?: LLMProviderListResponse) {
  if (!organization || !data) return undefined
  const own = data.data.find((p) => p.organization_id === organization.id)
  const global = data.data.find((p) => p.organization_id === null)
  if (own) return `${organization.name} uses ${providerName(own)} (${own.model}).`
  if (global)
    return `${organization.name} uses the global ${providerName(global)} (${global.model}).`
  return data.metadata.fallback
    ? `${organization.name} has no provider, so AI features use the server's default model.`
    : `${organization.name} has no provider, so AI features are off.`
}

/**
 * The AI providers the user can see: the global one, which a super user
 * manages, and one per organization, which its owner manages. An
 * organization's own provider wins over the global one.
 */
export default function LLMProviderSettings() {
  const [openAdd, setOpenAdd] = React.useState(false)
  const { organization, organizations } = useActiveOrganization()
  const { data, isPending, isError, error } = useQuery(queries.llmProvider.list())
  const providers = data?.data ?? []

  // Where a provider can run: global for a super user, and each organization;
  // a scope that already has a provider is taken.
  const taken = new Set(providers.map((p) => p.organization_id ?? GLOBAL))
  const scopeOptions: ScopeOption[] = [
    {
      value: GLOBAL,
      label: 'Global (all organizations)',
      disabled: !data?.metadata.super_user || taken.has(GLOBAL),
    },
    ...organizations.map((org) => ({
      value: org.id,
      label: org.name,
      disabled: taken.has(org.id),
    })),
  ]

  return (
    <SectionCard
      title="AI Providers"
      description={providerStatus(organization, data)}
      toolbar={
        <Button className="h-8.5 rounded-lg" onClick={() => setOpenAdd(true)}>
          <IconPlus />
          <span>Add provider</span>
        </Button>
      }
    >
      {isPending ? (
        <div className="grid gap-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : isError ? (
        <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
      ) : providers.length === 0 ? (
        <EmptyState
          title="No AI providers yet"
          description="Add one for an organization, or a global one for every organization."
        />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-xl text-left text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr>
                <th className="pb-2 pr-4 font-normal">Provider</th>
                <th className="pb-2 pr-4 font-normal">Endpoint</th>
                <th className="pb-2 pr-4 font-normal">Model</th>
                <th className="pb-2 pr-4 font-normal">Runs in</th>
                <th className="pb-2 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <ProviderRow key={provider.id} provider={provider} scopeOptions={scopeOptions} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openAdd && <ProviderDialog open onOpenChange={setOpenAdd} scopeOptions={scopeOptions} />}
    </SectionCard>
  )
}
