import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseAbstractForm } from '@/types/form'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/field'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import { AgentSkillFormSchema, type AgentSkillFormDto } from '@/lib/api/dtos/agent-skill/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'

import { botOptions, fromBotSelect, PICKED_BOT, toBotSelect } from './skill-bot'

type TModel = AgentSkillFormDto
type TMutation = AgentSkillFormDto
type TDto = AgentSkillFormDto
type TResponse = Models.AgentSkill

type AbstractFormProps = BaseAbstractForm<TModel, TMutation, TDto, TResponse> & {
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AbstractForm({
  organizationId,
  open,
  onOpenChange,
  defaultValues,
  schema,
  mutation,
  isEdit,
}: AbstractFormProps) {
  const bots = useQuery(queries.agentBots.list(organizationId)).data?.data ?? []
  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: schema,
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      try {
        const body = { ...value, agent_bot_id: fromBotSelect(value.agent_bot_id) }
        await mutation.mutateAsync(parseDto(schema, body))
        toast.success(`Skill ${isEdit ? 'updated' : 'created'} successfully`)
        onOpenChange(false)
        form.reset()
      } catch (error) {
        toastAxiosError(error)
      }
    },
  })

  return (
    <SimpleAlertScrollableDialogForm
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      open={open}
      onOpenChange={onOpenChange}
      title={`${isEdit ? 'Edit' : 'Create'} Custom Skill`}
      confirmText={isEdit ? 'Update' : 'Save'}
      loading={mutation.isPending}
      size="lg"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField asterisk label="Name" placeholder="e.g. Extract dates" maxLength={100} />
        )}
      />
      <form.AppField
        name="description"
        children={(field) => (
          <field.TextField
            label="Description"
            placeholder="e.g. lists every date and deadline in the email"
            maxLength={300}
          />
        )}
      />
      <form.AppField
        name="instruction"
        children={(field) => (
          <field.TextareaField
            asterisk
            label="Instruction"
            placeholder="What the AI should do with the email, e.g. List every date and deadline it mentions, with what happens on each, as a Markdown table."
            description="Runs on one email at a time. The email is passed as data, so instructions written inside it are never followed."
            rows={6}
            maxLength={5000}
          />
        )}
      />
      <form.AppField
        name="agent_bot_id"
        children={(field) => (
          <field.SelectField label="Agent bot" options={botOptions(bots)} placeholder="Choose" />
        )}
      />
      <form.Field
        name="is_enabled"
        children={(field) => (
          <Field orientation="horizontal">
            <Checkbox
              id={field.name}
              checked={field.state.value}
              onCheckedChange={(v) => field.handleChange(v === true)}
            />
            <FieldLabel htmlFor={field.name} className="font-normal">
              Show it in the Skills menu and the assistant's / commands
            </FieldLabel>
          </Field>
        )}
      />
    </SimpleAlertScrollableDialogForm>
  )
}

type AddSkillFormProps = {
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddSkillForm({ organizationId, open, onOpenChange }: AddSkillFormProps) {
  const mutation = useMutation(queries.agentSkills.create(organizationId))

  return (
    <AbstractForm
      organizationId={organizationId}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: '',
        description: '',
        instruction: '',
        agent_bot_id: PICKED_BOT,
        is_enabled: true,
      }}
      schema={AgentSkillFormSchema}
      mutation={mutation}
    />
  )
}

export function EditSkillForm({
  organizationId,
  open,
  onOpenChange,
  record,
}: AddSkillFormProps & { record: Models.AgentSkill }) {
  const mutation = useMutation(queries.agentSkills.update(record.key))

  return (
    <AbstractForm
      organizationId={organizationId}
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: record.name,
        description: record.description,
        instruction: record.instruction,
        agent_bot_id: toBotSelect(record.agent_bot_id),
        is_enabled: record.is_enabled,
      }}
      schema={AgentSkillFormSchema}
      mutation={mutation}
      isEdit
    />
  )
}
