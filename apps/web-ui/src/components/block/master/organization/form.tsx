import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'
import type { BaseAbstractForm } from '@/types/form'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { useAppForm } from '@/hooks/form'
import { toastAxiosError } from '@/lib/api/axios-error'
import {
  OrganizationFormSchema,
  type OrganizationFormDto,
} from '@/lib/api/dtos/master/organization/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'

type TModel = OrganizationFormDto
type TMutation = OrganizationFormDto
type TDto = OrganizationFormDto
type TResponse = Models.Organization

type AbstractFormProps = BaseAbstractForm<TModel, TMutation, TDto, TResponse> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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
        toast.success(`Organization ${isEdit ? 'updated' : 'created'} successfully`)
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
      title={`${isEdit ? 'Edit' : 'Create'} Organization`}
      confirmText={isEdit ? 'Update' : 'Save'}
      loading={mutation.isPending}
      size="md"
    >
      <form.AppField
        name="name"
        children={(field) => (
          <field.TextField asterisk label="Name" placeholder="e.g. Organization Name" />
        )}
      />
    </SimpleAlertScrollableDialogForm>
  )
}

type AddOrganizationFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddOrganizationForm({ open, onOpenChange }: AddOrganizationFormProps) {
  const mutation = useMutation(queries.organizations.create())

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{
        name: '',
      }}
      schema={OrganizationFormSchema}
      mutation={mutation}
    />
  )
}

type EditOrganizationFormProps = AddOrganizationFormProps & {
  record: Models.Organization
}

export function EditOrganizationForm({ open, onOpenChange, record }: EditOrganizationFormProps) {
  const mutation = useMutation(queries.organizations.update(record.id))

  return (
    <AbstractForm
      open={open}
      onOpenChange={onOpenChange}
      defaultValues={{ ...record }}
      schema={OrganizationFormSchema}
      mutation={mutation}
      isEdit
    />
  )
}
