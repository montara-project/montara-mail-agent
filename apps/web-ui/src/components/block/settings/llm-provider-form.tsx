import { useMutation, useQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-form'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import SectionCard from '@/components/block/common/section-card'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { parseDto } from '@/lib/api/dtos/parse'
import { LLMProviderFormSchema } from '@/lib/api/dtos/settings/llm-provider/schema'
import { queries } from '@/lib/api/queries'

const KIND_OPTIONS: { value: Models.LLMProviderKind; label: string }[] = [
  { value: 'openai', label: 'OpenAI compatible' },
  { value: 'anthropic', label: 'Anthropic compatible' },
]

const PLACEHOLDERS: Record<Models.LLMProviderKind, { baseURL: string; model: string }> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'e.g. gpt-5-mini' },
  anthropic: { baseURL: 'https://api.anthropic.com', model: 'e.g. claude-sonnet-5-5' },
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

  const form = useAppForm({
    defaultValues: {
      kind: provider?.kind ?? 'openai',
      base_url: provider?.base_url ?? '',
      model: provider?.model ?? '',
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
  const kind = useStore(form.store, (state) => state.values.kind)

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.AppField
        name="kind"
        children={(field) => (
          <field.SelectField asterisk label="API format" options={KIND_OPTIONS} />
        )}
      />
      <form.AppField
        name="base_url"
        children={(field) => (
          <field.TextField
            label="Base URL"
            placeholder={PLACEHOLDERS[kind].baseURL}
            inputMode="url"
          />
        )}
      />
      <FieldDescription>
        Leave empty for the vendor's own API. Any compatible server works: OpenRouter, Groq, a vLLM
        or LiteLLM proxy, and so on.
      </FieldDescription>
      <form.AppField
        name="model"
        children={(field) => (
          <field.TextField asterisk label="Model" placeholder={PLACEHOLDERS[kind].model} />
        )}
      />
      <form.AppField
        name="api_key"
        children={(field) => (
          <field.PasswordField
            asterisk={!provider?.has_api_key}
            label="API key"
            placeholder={
              provider?.has_api_key ? 'Saved; leave empty to keep it' : 'Paste the API key'
            }
          />
        )}
      />
      <div className="flex items-center gap-2">
        <form.AppForm>
          <form.SubmitButton label="Save" />
        </form.AppForm>
        {provider && (
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

/**
 * The model the active organization's AI features call: summaries, importance
 * and reply suggestions. Only the organization's owner can change it.
 */
export default function LLMProviderSettings() {
  const { organization } = useActiveOrganization()
  const { data, isPending, isError, error } = useQuery(queries.llmProvider.get(organization?.id))
  const provider = data?.data ?? null

  const status = provider
    ? `AI features use ${provider.model}.`
    : data?.metadata.fallback
      ? "No provider is set, so AI features use the server's default model."
      : 'No provider is set, so AI features are off for this organization.'

  return (
    <SectionCard
      title="LLM provider"
      description={organization ? `${organization.name}: ${status}` : undefined}
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
        <ProviderForm
          key={`${organization.id}:${provider?.updated_at}`}
          organizationId={organization.id}
          provider={provider}
        />
      ) : (
        <p className="text-muted-foreground text-sm">Create an organization first.</p>
      )}
    </SectionCard>
  )
}
