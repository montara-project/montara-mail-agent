import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import googleLogo from '@/assets/brands/google.svg'
import SectionCard from '@/components/block/common/section-card'
import { FieldDescription } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppForm } from '@/hooks/form'
import { useHideEmails } from '@/hooks/use-hide-emails'
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
      className="grid gap-4"
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

/** How an account without a password, or one linked to Google, signs in. */
function SignInMethod({ security }: { security: Models.UserSecurity }) {
  const { data: me } = useQuery(queries.auth.profile())
  const { mask } = useHideEmails()

  return (
    <SectionCard title="Sign-in method" description="How you sign in to Montara.">
      {security.has_google ? (
        <div className="grid gap-3">
          <div className="flex items-center gap-3 text-sm">
            <img src={googleLogo} alt="" className="size-5 shrink-0" />
            <div className="grid min-w-0">
              <span className="font-medium">Google</span>
              <span className="text-muted-foreground truncate">{mask(me?.user?.email ?? '')}</span>
            </div>
          </div>
          {!security.has_password && (
            <FieldDescription>
              You sign in with Google, so there's no password to change here.
            </FieldDescription>
          )}
        </div>
      ) : (
        <FieldDescription>
          This account signs in with an email link, so it has no password to change.
        </FieldDescription>
      )}
    </SectionCard>
  )
}

/** Change the password, only for an account that has one; any other sign-in gets its own card. */
export default function PasswordSettings() {
  const { data, isPending, isError, error } = useQuery(queries.profile.security())

  if (isPending) return <Skeleton className="h-40" />
  if (isError) {
    return (
      <SectionCard title="Sign-in method" description="How you sign in to Montara.">
        <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
      </SectionCard>
    )
  }

  return (
    <>
      {(data.has_google || !data.has_password) && <SignInMethod security={data} />}
      {data.has_password && (
        <SectionCard
          title="Change password"
          description="Use a password you don't use anywhere else."
        >
          <PasswordForm />
        </SectionCard>
      )}
    </>
  )
}
