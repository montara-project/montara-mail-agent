import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import SectionCard from '@/components/block/common/section-card'
import { FieldDescription } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { parseDto } from '@/lib/api/dtos/parse'
import { UpdatePasswordSchema } from '@/lib/api/dtos/settings/profile/schema'
import { queries } from '@/lib/api/queries'
import { clearAuthTokens } from '@/lib/auth/token-storage'
import { getQueryClient } from '@/lib/providers/react-query'

function PasswordForm() {
  const change = useMutation(queries.profile.changePassword())
  const navigate = useNavigate()

  const form = useAppForm({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
    validators: { onSubmit: UpdatePasswordSchema, onChange: UpdatePasswordSchema },
    onSubmit: async ({ value }) => {
      try {
        await change.mutateAsync(parseDto(UpdatePasswordSchema, value))
      } catch (error) {
        toastAxiosError(error)
        return
      }
      // The server ended every session, this one included.
      clearAuthTokens()
      getQueryClient().clear()
      toast.success('Password changed. Sign in with the new one.')
      await navigate({ to: '/sign-in', replace: true })
    },
  })

  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.AppField
        name="current_password"
        children={(field) => <field.PasswordField asterisk label="Current password" />}
      />
      <form.AppField
        name="new_password"
        children={(field) => <field.PasswordField asterisk label="New password" />}
      />
      <form.AppField
        name="confirm_password"
        children={(field) => <field.PasswordField asterisk label="Confirm new password" />}
      />
      <FieldDescription>
        At least 8 characters. Changing it signs you out everywhere, this browser included.
      </FieldDescription>
      <div>
        <form.AppForm>
          <form.SubmitButton label="Change password" />
        </form.AppForm>
      </div>
    </form>
  )
}

/** Change the password; for an account that signs in without one, say so. */
export default function PasswordSettings() {
  const { data, isPending, isError, error } = useQuery(queries.profile.security())

  return (
    <SectionCard title="Change password" description="Use a password you don't use anywhere else.">
      {isPending ? (
        <div className="grid max-w-xl gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : isError ? (
        <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
      ) : data.has_password ? (
        <PasswordForm />
      ) : (
        <p className="text-muted-foreground text-sm">
          This account signs in with Google or an email link, so it has no password to change.
        </p>
      )}
    </SectionCard>
  )
}
