import { useStore } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseAbstractForm } from '@/types/form'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { composePersona } from '@/lib/api/agent/bot-prompt'
import { toastAxiosError } from '@/lib/api/axios-error'
import { AgentBotFormSchema, type AgentBotFormDto } from '@/lib/api/dtos/agent-bot/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'

type TModel = AgentBotFormDto
type TMutation = AgentBotFormDto
type TDto = AgentBotFormDto
type TResponse = Models.AgentBot

type AbstractFormProps = BaseAbstractForm<TModel, TMutation, TDto, TResponse> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The four persona fields, in the order the system prompt lists them. */
const PERSONA_FIELDS = [
  {
    name: 'soul',
    label: 'Soul',
    placeholder: 'Who the bot is: its role, values and attitude.',
  },
  {
    name: 'memory',
    label: 'Memory',
    placeholder: 'Facts it should always know: the team, products, recurring contacts.',
  },
  {
    name: 'style',
    label: 'Style',
    placeholder: 'How it writes: tone, length, greeting and sign-off.',
  },
  {
    name: 'instruction',
    label: 'Instructions',
    placeholder: 'What it must or must not do.',
  },
] as const

function AbstractForm({
  open,
  onOpenChange,
  defaultValues,
  schema,
  mutation,
  isEdit,
}: AbstractFormProps) {
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      try {
        await mutation.mutateAsync(parseDto(schema, value))
        toast.success(`Agent bot ${isEdit ? 'updated' : 'created'} successfully`)
        onOpenChange(false)
        form.reset()
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  // The preview trims like the schema does, so it shows what will be saved.
  const values = useStore(form.store, (state) => state.values)
  const systemPrompt = composePersona({
    ...values,
    name: values.name.trim() || 'Untitled bot',
    description: values.description.trim(),
  })

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title={`${isEdit ? 'Edit' : 'Create'} Agent Bot`}
      confirmText={isEdit ? 'Update' : 'Save'}
      loading={mutation.isPending}
      size="lg"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField asterisk label="Name" placeholder="e.g. Support Bot" maxLength={100} />
        )}
      />
      <form.AppField
        name="description"
        children={(field) => (
          <field.TextField
            label="Description"
            placeholder="e.g. answers customer questions in the support inbox"
            maxLength={300}
          />
        )}
      />
      {PERSONA_FIELDS.map(({ name, label, placeholder }) => (
        <form.AppField
          key={name}
          name={name}
          children={(field) => (
            <field.TextareaField
              label={label}
              placeholder={placeholder}
              rows={4}
              maxLength={5000}
            />
          )}
        />
      ))}
      <form.Field
        name="is_default"
        children={(field) => (
          <Field orientation="horizontal">
            <Checkbox
              id={field.name}
              checked={field.state.value}
              onCheckedChange={(v) => field.handleChange(v === true)}
            />
            <FieldLabel htmlFor={field.name} className="font-normal">
              Set as default bot
            </FieldLabel>
          </Field>
        )}
      />
      <p className="text-muted-foreground -mt-2 text-xs">
        The default bot drafts the automatic replies in the AI Drafts queue.
      </p>
      <Field>
        <FieldLabel htmlFor="agent-bot-system-prompt">System prompt</FieldLabel>
        <pre
          id="agent-bot-system-prompt"
          className="bg-muted max-h-60 overflow-y-auto rounded-md border px-3 py-2 font-mono text-xs whitespace-pre-wrap"
        >
          {systemPrompt}
        </pre>
        <FieldDescription>
          Built from the fields above. The date and the mailbox are added automatically, and the
          agent's safety rules always follow it.
        </FieldDescription>
      </Field>
    </SimpleAlertScrollableDialogForm>
  )
}

type AddAgentBotFormProps = {
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddAgentBotForm({ organizationId, open, onOpenChange }: AddAgentBotFormProps) {
  const mutation = useMutation(queries.agentBots.create(organizationId))

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: '',
        description: '',
        soul: '',
        memory: '',
        style: '',
        instruction: '',
        is_default: false,
      }}
      schema={AgentBotFormSchema}
      mutation={mutation}
    />
  )
}

type EditAgentBotFormProps = Omit<AddAgentBotFormProps, 'organizationId'> & {
  record: Models.AgentBot
}

export function EditAgentBotForm({ open, onOpenChange, record }: EditAgentBotFormProps) {
  const mutation = useMutation(queries.agentBots.update(record.id))

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: record.name,
        description: record.description,
        soul: record.soul,
        memory: record.memory,
        style: record.style,
        instruction: record.instruction,
        is_default: record.is_default,
      }}
      schema={AgentBotFormSchema}
      mutation={mutation}
      isEdit
    />
  )
}
