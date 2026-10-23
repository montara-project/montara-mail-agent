import { useMutation } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-form'
import { Trash2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { parseDto } from '@/lib/api/dtos/parse'
import { SelfHostedFormSchema } from '@/lib/api/dtos/settings/llm-provider/schema'
import { queries } from '@/lib/api/queries'

import {
  keyIsSaved,
  ModelSuggestions,
  ProviderSettings,
  useProviderModels,
} from './llm-provider-form'

// Each serves the OpenAI format under /v1 on its default port.
const PRESETS = [
  { name: 'Ollama', url: 'http://localhost:11434/v1' },
  { name: 'LM Studio', url: 'http://localhost:1234/v1' },
  { name: 'vLLM', url: 'http://localhost:8000/v1' },
  { name: 'LocalAI', url: 'http://localhost:8080/v1' },
]

/** Loopback, private and link-local hosts, which the server refuses unless ALLOW_PRIVATE_HOSTS is on. */
function isPrivateHost(baseURL: string) {
  try {
    const host = new URL(baseURL).hostname
    return (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host === '[::1]' ||
      /^(127|10)\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host)
    )
  } catch {
    return false
  }
}

function SelfHostedForm({
  organizationId,
  provider,
  privateHosts,
}: {
  organizationId: string
  provider: Models.LLMProvider | null
  privateHosts: boolean
}) {
  const save = useMutation(queries.llmProvider.save(organizationId))
  const remove = useMutation(queries.llmProvider.delete(organizationId))
  const listId = React.useId()
  // A hosted provider is managed on its own page; this form starts empty.
  const own = provider?.kind === 'self_hosted' ? provider : null

  const form = useAppForm({
    defaultValues: {
      kind: 'self_hosted' as const,
      base_url: own?.base_url ?? '',
      model: own?.model ?? '',
      api_key: '',
    },
    validators: { onSubmit: SelfHostedFormSchema, onChange: SelfHostedFormSchema },
    onSubmit: async ({ value }) => {
      try {
        const dto = parseDto(SelfHostedFormSchema, value)
        await save.mutateAsync(dto)
        toast.success('Self-hosted model saved')
        form.setFieldValue('api_key', '')
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })
  const { base_url, api_key } = useStore(form.store, (state) => state.values)
  const saved = keyIsSaved(own, 'self_hosted', base_url)
  const validURL = /^https?:\/\/\S+$/.test(base_url.trim())
  const models = useProviderModels(
    organizationId,
    { kind: 'self_hosted', base_url: base_url.trim(), api_key: api_key.trim() },
    validURL
  )

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      {provider && provider.kind !== 'self_hosted' && (
        <p role="note" className="rounded-lg border border-amber-500/40 p-3 text-sm">
          A hosted provider ({provider.model}) is in use. Saving a self-hosted model replaces it.
        </p>
      )}
      <div className="grid gap-2">
        <span className="text-sm font-medium">Server</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={base_url === preset.url}
              className="aria-pressed:border-primary"
              onClick={() => form.setFieldValue('base_url', preset.url)}
            >
              {preset.name}
            </Button>
          ))}
        </div>
      </div>
      <form.AppField
        name="base_url"
        children={(field) => (
          <field.TextField
            asterisk
            label="Base URL"
            placeholder="http://localhost:11434/v1"
            inputMode="url"
          />
        )}
      />
      <FieldDescription>
        Any server with an OpenAI-compatible API. The API server calls it, so localhost means the
        machine the API runs on, not your browser's.
      </FieldDescription>
      {!privateHosts && isPrivateHost(base_url) && (
        <p role="alert" className="rounded-lg border border-amber-500/40 p-3 text-sm">
          This server refuses local and private network addresses. Set{' '}
          <code className="font-mono">ALLOW_PRIVATE_HOSTS=true</code> on the API server to use a
          model on the same machine or network.
        </p>
      )}
      <form.AppField
        name="api_key"
        children={(field) => (
          <field.PasswordField
            label="API key"
            placeholder={
              saved ? 'Saved; leave empty to keep it' : 'Optional: only if the server asks'
            }
          />
        )}
      />
      <form.AppField
        name="model"
        children={(field) => (
          <field.TextField
            asterisk
            label="Model"
            placeholder="e.g. llama3.2"
            list={listId}
            autoComplete="off"
          />
        )}
      />
      <ModelSuggestions
        listId={listId}
        models={models}
        idleHint="Enter the base URL to load the server's models."
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
                  toast.success('Self-hosted model removed')
                  form.reset({ kind: 'self_hosted', base_url: '', model: '', api_key: '' })
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

/** A model the organization runs itself (Ollama, LM Studio, vLLM), for the same AI features. */
export default function SelfHostedSettings() {
  return (
    <ProviderSettings title="Self-hosted model">
      {(props) => <SelfHostedForm {...props} />}
    </ProviderSettings>
  )
}
