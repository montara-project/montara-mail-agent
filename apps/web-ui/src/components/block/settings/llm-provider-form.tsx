import { useStore } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { RefreshCw, Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { LLMModelsBody, LLMProviderResponse } from '@/lib/api/services/types/llm-provider'

import SectionCard from '@/components/block/common/section-card'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
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

/** Whether the saved provider's key is the one the form would use: same kind and base URL. */
export function keyIsSaved(provider: Models.LLMProvider | null, kind: string, baseURL: string) {
  return !!provider?.has_api_key && provider.kind === kind && provider.base_url === baseURL.trim()
}

/**
 * The models the provider in the form offers, fetched again once its kind,
 * base URL and key have settled, so the model list follows the form.
 */
export function useProviderModels(organizationId: string, body: LLMModelsBody, ready: boolean) {
  // A string, so the debounce sees a change only when a value changes.
  const settled = useDebounce({ value: JSON.stringify(body), delay: 600 })
  const current = settled === JSON.stringify(body)
  return useQuery(queries.llmProvider.models(organizationId, JSON.parse(settled), ready && current))
}

/**
 * Below the model field: the provider's models as the field's suggestions
 * (a native datalist, so any id can still be typed), and how the list went.
 */
export function ModelSuggestions({
  listId,
  models,
  idleHint,
}: {
  listId: string
  models: ReturnType<typeof useProviderModels>
  /** Shown while the form lacks what the list needs, e.g. the key. */
  idleHint: string
}) {
  const { data, isFetching, isError, error, refetch, fetchStatus, isPending } = models
  const idle = isPending && fetchStatus === 'idle'

  return (
    <>
      <datalist id={listId}>
        {data?.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </datalist>
      <div className="-mt-2 flex items-center gap-2" aria-live="polite">
        <FieldDescription className={isError ? 'text-destructive' : undefined}>
          {idle
            ? idleHint
            : isFetching
              ? 'Loading the models...'
              : isError
                ? axiosErrorMessage(error)
                : data?.length
                  ? `${data.length} models found: pick one or type its id.`
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
    </>
  )
}

function ProviderForm({
  organizationId,
  provider,
}: {
  organizationId: string
  provider: Models.LLMProvider | null
}) {
  const save = useMutation(queries.llmProvider.save(organizationId))
  const remove = useMutation(queries.llmProvider.delete(organizationId))
  const listId = React.useId()
  // A self-hosted model is managed on its own page; this form starts empty.
  const own = provider && provider.kind !== 'self_hosted' ? provider : null

  const form = useAppForm({
    defaultValues: {
      kind: own?.kind ?? 'openai',
      base_url: own?.base_url ?? '',
      model: own?.model ?? '',
      api_key: '',
    },
    validators: { onSubmit: LLMProviderFormSchema, onChange: LLMProviderFormSchema },
    onSubmit: async ({ value }) => {
      try {
        const dto = parseDto(LLMProviderFormSchema, value)
        await save.mutateAsync(dto)
        toast.success('LLM provider saved')
        form.setFieldValue('api_key', '')
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })
  const { kind, base_url, api_key } = useStore(form.store, (state) => state.values)
  const saved = keyIsSaved(own, kind, base_url)
  const models = useProviderModels(
    organizationId,
    { kind, base_url: base_url.trim(), api_key: api_key.trim() },
    saved || api_key.trim() !== ''
  )
  const placeholders = PLACEHOLDERS[kind === 'anthropic' ? 'anthropic' : 'openai']

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      {provider?.kind === 'self_hosted' && (
        <p role="note" className="rounded-lg border border-amber-500/40 p-3 text-sm">
          A self-hosted model ({provider.model}) is in use. Saving a provider here replaces it.
        </p>
      )}
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
        children={(field) => (
          <field.TextField
            asterisk
            label="Model"
            placeholder={placeholders.model}
            list={listId}
            autoComplete="off"
          />
        )}
      />
      <ModelSuggestions
        listId={listId}
        models={models}
        idleHint="Enter the API key to load the provider's models."
      />
      <div className="flex items-center gap-2">
        <form.AppForm>
          <form.SubmitButton label="Save" />
        </form.AppForm>
        {own && (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  toast.success('LLM provider removed')
                  form.reset({ kind: 'openai', base_url: '', model: '', api_key: '' })
                },
                onError: toastAxiosError,
              })
            }
          >
            <Trash2 />
            Remove
          </Button>
        )}
      </div>
    </form>
  )
}

/** One line on the model the organization's AI features call now. */
function providerStatus(data?: LLMProviderResponse) {
  const provider = data?.data
  if (provider?.kind === 'self_hosted')
    return `AI features use ${provider.model} on your own server.`
  if (provider) return `AI features use ${provider.model}.`
  return data?.metadata.fallback
    ? "No provider is set, so AI features use the server's default model."
    : 'No provider is set, so AI features are off for this organization.'
}

/**
 * The active organization's provider, loaded, around one of its forms. Only
 * the organization's owner can change it.
 */
export function ProviderSettings({
  title,
  children,
}: {
  title: string
  children: (props: {
    organizationId: string
    provider: Models.LLMProvider | null
    privateHosts: boolean
  }) => React.ReactNode
}) {
  const { organization } = useActiveOrganization()
  const { data, isPending, isError, error } = useQuery(queries.llmProvider.get(organization?.id))
  const provider = data?.data ?? null

  return (
    <SectionCard
      title={title}
      description={organization ? `${organization.name}: ${providerStatus(data)}` : undefined}
    >
      {isPending && organization ? (
        <div className="grid max-w-xl gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : isError ? (
        <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
      ) : organization ? (
        // Remounted per organization and per saved provider, so the fields start from what is stored.
        <React.Fragment key={`${organization.id}:${provider?.updated_at}`}>
          {children({
            organizationId: organization.id,
            provider,
            privateHosts: !!data?.metadata.private_hosts,
          })}
        </React.Fragment>
      ) : (
        <p className="text-muted-foreground text-sm">Create an organization first.</p>
      )}
    </SectionCard>
  )
}

/**
 * The hosted model the active organization's AI features call: summaries,
 * importance and reply suggestions.
 */
export default function LLMProviderSettings() {
  return (
    <ProviderSettings title="LLM provider">
      {(props) => <ProviderForm {...props} />}
    </ProviderSettings>
  )
}
