import { useMutation } from '@tanstack/react-query'

import type { Models } from '@/lib/api/models'

import SimpleAlertScrollableDialogForm from '@/components/block/common/simple-alert-scrollable-dialog-form'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { useAppForm } from '@/hooks/form'
import { toastProgress } from '@/lib/api/axios-error'
import { ForwardFormSchema, parseRecipients } from '@/lib/api/dtos/mail/forward/schema'
import { parseDto } from '@/lib/api/dtos/parse'
import { queries } from '@/lib/api/queries'

/** Forwards a mail from its own account, with an optional note on top. */
export default function ForwardDialog({
  mail,
  onClose,
}: {
  mail: Models.Mail
  onClose: () => void
}) {
  const forward = useMutation(queries.mails.forward(mail.id))

  const form = useAppForm({
    defaultValues: { to: '', note: '' },
    validators: { onSubmit: ForwardFormSchema, onChange: ForwardFormSchema },
    onSubmit: async ({ value }) => {
      const progress = toastProgress('Forwarding...')
      try {
        const dto = parseDto(ForwardFormSchema, value)
        const to = parseRecipients(dto.to)
        await forward.mutateAsync({ to, note: dto.note.trim() || undefined })
        progress.success(`Forwarded to ${to.join(', ')}`)
        onClose()
      } catch (error) {
        progress.error(error)
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
      title="Forward email"
      description={`Fwd: ${mail.subject || '(no subject)'}`}
      confirmText="Forward"
      loading={forward.isPending}
      size="md"
    >
      <div className="grid gap-4">
        <form.AppField
          name="to"
          children={(field) => (
            <field.TextField
              asterisk
              label="To"
              placeholder="name@example.com, other@example.com"
            />
          )}
        />
        <form.Field
          name="note"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Note</FieldLabel>
              <Textarea
                id={field.name}
                rows={4}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Add a message above the forwarded email"
              />
            </Field>
          )}
        />
        <FieldDescription>
          Sent from this mailbox. Attachments of the original are not included.
        </FieldDescription>
      </div>
    </SimpleAlertScrollableDialogForm>
  )
}
