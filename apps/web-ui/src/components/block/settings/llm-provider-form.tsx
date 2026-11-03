import { useStore } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Building2,
  Check,
  ChevronDown,
  Cpu,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react'
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
import SectionHeading from '@/components/block/common/section-heading'
import { SettingsCard, SettingsPage } from '@/components/block/common/settings-card'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
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

/** The select's value for the platform scope; organization ids fill the rest. */
const PLATFORM = 'platform'
const toScope = (value: string): LLMProviderScope => (value === PLATFORM ? null : value)

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
  const settled = useDebounce(JSON.stringify(body), 600)
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

  const message = () => {
    if (idle) return idleHint
    if (isFetching) return 'Loading the models...'
    if (isError) return axiosErrorMessage(error)
    if (data?.length) return `${data.length} models found.`
    return 'The provider listed no models; type the id.'
  }

  return (
    <div className="-mt-2 flex items-center gap-2" aria-live="polite">
      <FieldDescription className={isError ? 'text-destructive' : undefined}>
        {message()}
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
  const scopeValue = provider ? (provider.organization_id ?? PLATFORM) : picked
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
  // Once the provider lists its models, the field is a searchable combobox
  // of them (the chosen one kept even when the list lacks it, and any other
  // id usable from the search); until then, or when the list fails or is
  // empty, the id is typed.
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
        <p
          role="note"
          className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-pretty"
        >
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
            Platform runs for every user, in every organization with no provider of its own.
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
            <field.ComboboxField
              asterisk
              allowCustom
              label="Model"
              placeholder="Pick a model"
              searchPlaceholder="Search models..."
              emptyText="No model matches."
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

/** The column widths the design gives the provider table; the endpoint takes the rest. */
const PROVIDER_COL = 'w-full md:w-[150px] md:shrink-0'
const MODEL_COL = 'md:w-[188px] md:shrink-0'
const RUNS_COL = 'md:w-[110px] md:shrink-0'
const ACTIONS_COL = 'md:w-[132px] md:shrink-0'

/** The column labels: mono, uppercase, faint, above the rows. */
function ProviderTableHead() {
  return (
    <div className="hidden items-center gap-2.5 px-2.5 py-[7px] md:flex">
      <span
        className={`text-ink-faint font-mono text-[9px] leading-3 font-semibold tracking-[0.8px] uppercase ${PROVIDER_COL}`}
      >
        Provider
      </span>
      <span className="text-ink-faint min-w-0 flex-1 font-mono text-[9px] leading-3 font-semibold tracking-[0.8px] uppercase">
        Endpoint
      </span>
      <span
        className={`text-ink-faint font-mono text-[9px] leading-3 font-semibold tracking-[0.8px] uppercase ${MODEL_COL}`}
      >
        Model
      </span>
      <span
        className={`text-ink-faint font-mono text-[9px] leading-3 font-semibold tracking-[0.8px] uppercase ${RUNS_COL}`}
      >
        Runs in
      </span>
      <span className={ACTIONS_COL}>
        <span className="sr-only">Actions</span>
      </span>
    </div>
  )
}

/** "Built-in" is the vendor's own endpoint; anything else is a custom one. */
function providerTag(provider: Models.LLMProviderListed) {
  return provider.base_url ? 'Custom' : 'Built-in'
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
  const current = provider.organization_id ?? PLATFORM

  const moveTo = (option: ScopeOption) =>
    move.mutate(
      { id: provider.id, scope: toScope(option.value) },
      {
        onSuccess: () => toast.success(`${providerName(provider)} now runs in ${option.label}`),
        onError: toastAxiosError,
      }
    )

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[8px] px-2.5 py-2 md:flex-nowrap">
      <div className={`flex items-center gap-[9px] ${PROVIDER_COL}`}>
        <span className="bg-accent-tint grid size-[26px] shrink-0 place-items-center rounded-[7px]">
          <Cpu className="text-accent-ink size-3" aria-hidden />
        </span>
        <span className="grid min-w-0 gap-px">
          <span className="truncate text-xs leading-4 font-semibold">{providerName(provider)}</span>
          <span className="text-ink-faint truncate text-[10px] leading-[14px]">
            {providerTag(provider)}
          </span>
        </span>
      </div>

      <span className="text-ink-3 order-4 basis-full min-w-0 truncate font-mono text-[10.5px] leading-[15px] md:order-none md:basis-auto md:flex-1">
        {providerEndpoint(provider)}
      </span>

      <span
        className={`text-ink-3 order-5 truncate font-mono text-[10.5px] leading-[15px] md:order-none ${MODEL_COL}`}
      >
        {provider.model || '—'}
      </span>

      {/* The chip is the picker: its chevron promises the menu it opens. */}
      <div className={`order-2 md:order-none ${RUNS_COL}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={move.isPending}
              aria-label={`Where ${providerName(provider)} runs`}
              className="bg-muted text-muted-foreground hover:bg-accent focus-visible:ring-ring/50 flex h-6 w-full items-center justify-between gap-[5px] rounded-chip border px-[7px] text-[10.5px] leading-[14px] outline-none transition-colors duration-150 focus-visible:ring-[3px] disabled:opacity-60 motion-reduce:transition-none"
            >
              <span className="flex min-w-0 items-center gap-[5px]">
                <span className="bg-success size-[5px] shrink-0 rounded-full" aria-hidden />
                <span className="truncate">
                  {provider.organization_id ? provider.organization_name : 'Platform'}
                </span>
              </span>
              <ChevronDown className="text-ink-faint size-[9px] shrink-0" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="text-muted-foreground text-xs">Runs in</DropdownMenuLabel>
            {scopeOptions.map((option, index) => (
              <React.Fragment key={option.value}>
                {index === 1 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  disabled={option.value === current || option.disabled}
                  onSelect={() => moveTo(option)}
                >
                  {option.value === PLATFORM ? <Users /> : <Building2 />}
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.value === current && <Check />}
                </DropdownMenuItem>
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className={`order-3 ml-auto flex items-center justify-end gap-[3px] md:order-none md:ml-0 ${ACTIONS_COL}`}
      >
        <Hint label="Edit">
          <Button
            variant="ghost"
            mode="icon"
            aria-label={`Edit ${providerName(provider)}`}
            className="text-muted-foreground size-5 rounded-tag pointer-coarse:size-11"
            onClick={() => setOpenEdit(true)}
          >
            <Pencil className="size-[11px]" />
          </Button>
        </Hint>
        <Hint label="Delete">
          <Button
            variant="ghost"
            mode="icon"
            aria-label={`Delete ${providerName(provider)}`}
            className="text-danger-soft hover:text-danger-soft size-5 rounded-tag pointer-coarse:size-11"
            onClick={() => setOpenDelete(true)}
          >
            <Trash2 className="size-[11px]" />
          </Button>
        </Hint>
      </div>

      <SimpleAlertDialog
        title={`Delete ${providerName(provider)}?`}
        description={
          provider.organization_id
            ? `${provider.organization_name} falls back to the platform provider, or the server's model.`
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
    </div>
  )
}

/** One line on the provider the active organization's AI features call now. */
function providerStatus(organization?: Models.Organization, data?: LLMProviderListResponse) {
  if (!organization || !data) return undefined
  const own = data.data.find((p) => p.organization_id === organization.id)
  const platform = data.data.find((p) => p.organization_id === null)
  if (own) return `${organization.name} uses ${providerName(own)} (${own.model}).`
  if (platform)
    return `${organization.name} uses the platform's ${providerName(platform)} (${platform.model}).`
  return data.metadata.fallback
    ? `${organization.name} has no provider, so AI features use the server's default model.`
    : `${organization.name} has no provider, so AI features are off.`
}

/**
 * The AI providers the user can see: the platform one, which a super user
 * manages, and one per organization, which its owner manages. An
 * organization's own provider wins over the platform one.
 */
export default function LLMProviderSettings() {
  const [openAdd, setOpenAdd] = React.useState(false)
  const { organization, organizations } = useActiveOrganization()
  const { data, isPending, isError, error } = useQuery(queries.llmProvider.list())
  const providers = data?.data ?? []

  // Where a provider can run: the platform for a super user, and each organization;
  // a scope that already has a provider is taken.
  const taken = new Set(providers.map((p) => p.organization_id ?? PLATFORM))
  const scopeOptions: ScopeOption[] = [
    {
      value: PLATFORM,
      label: 'Platform (all users)',
      disabled: !data?.metadata.super_user || taken.has(PLATFORM),
    },
    ...organizations.map((org) => {
      return {
        value: org.id,
        label: org.name,
        disabled: taken.has(org.id),
      }
    }),
  ]

  const content = () => {
    if (isPending) {
      return (
        <div className="grid gap-2 px-2.5 pt-2.5 pb-1.5">
          <Skeleton className="h-10 rounded-[8px]" />
          <Skeleton className="h-10 rounded-[8px]" />
        </div>
      )
    }
    if (isError) {
      return <p className="text-destructive px-2.5 py-3 text-sm">{axiosErrorMessage(error)}</p>
    }
    if (providers.length === 0) {
      return (
        <EmptyState
          className="border-0 py-10"
          title="No AI providers yet"
          description="Add one for an organization, or a platform one for every user."
        />
      )
    }
    return (
      <div className="px-2.5 pt-2.5 pb-1.5">
        <ProviderTableHead />
        {providers.map((provider, index) => (
          <React.Fragment key={provider.id}>
            {index > 0 && <div className="bg-border h-px" aria-hidden />}
            <ProviderRow provider={provider} scopeOptions={scopeOptions} />
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <SettingsPage>
      <SectionHeading
        title="AI Providers"
        description={`Endpoints and models for your AI features. ${organization?.name ?? 'This workspace'} falls back to the platform router.`}
      />

      <SettingsCard
        icon={Cpu}
        tone="ai"
        body="flush"
        title="Configured providers"
        description={
          providerStatus(organization, data) ??
          'Every provider this account can reach, and where each one runs.'
        }
        action={
          <Button
            variant="secondary"
            className="border-border bg-muted hover:bg-accent h-[27px] shrink-0 gap-1.5 rounded-[7px]! border px-[11px] text-[11px] leading-[15px] font-semibold shadow-none [&_svg]:size-[11px] pointer-coarse:h-11"
            onClick={() => setOpenAdd(true)}
          >
            <Plus />
            <span>Add provider</span>
          </Button>
        }
        footer={
          <div className="flex items-center gap-2">
            <Info className="text-ink-faint size-[11px] shrink-0" aria-hidden />
            <p className="text-ink-3 text-[10.5px] leading-[14px] text-pretty">
              Requests route to the first provider with a valid key, then fall back to the platform
              router.
            </p>
          </div>
        }
      >
        {content()}
      </SettingsCard>

      {openAdd && <ProviderDialog open onOpenChange={setOpenAdd} scopeOptions={scopeOptions} />}
    </SettingsPage>
  )
}
