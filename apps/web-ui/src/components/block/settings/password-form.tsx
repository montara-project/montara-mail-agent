import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { KeyRound, LogIn } from 'lucide-react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import googleLogo from '@/assets/brands/google.svg'
import { SettingsCard } from '@/components/block/common/settings-card'
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

// The design's denser fields, for this form only: the shared field stays as it is
// elsewhere, and touch screens keep their larger targets and 16px text.
const FIELDS =
  'grid gap-3.5 [&_[data-slot=field]]:gap-[5px] [&_[data-slot=field-label]]:text-[11.5px] [&_[data-slot=field-label]]:leading-4 [&_[data-slot=field-label]]:font-semibold pointer-fine:[&_[data-slot=input-wrapper]]:h-9.5 pointer-fine:[&_[data-slot=input-wrapper]_svg]:size-3.5 pointer-fine:[&_input]:text-[12.5px]'

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
      className={FIELDS}
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <form.AppField
        name="current_password"
        children={(field) => (
          <field.PasswordField asterisk label="Current password" autoComplete="current-password" />
        )}
      />
      <form.AppField
        name="new_password"
        children={(field) => (
          <field.PasswordField
            asterisk
            label="New password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        )}
      />
      <form.AppField
        name="confirm_password"
        children={(field) => (
          <field.PasswordField
            asterisk
            label="Confirm new password"
            placeholder="Repeat the new password"
            autoComplete="new-password"
          />
        )}
      />
      <FieldDescription className="text-ink-3 text-[10.5px] leading-[14px]">
        Changing your password signs you out everywhere, this browser included.
      </FieldDescription>
      <div>
        <form.AppForm>
          <form.SubmitButton
            label="Change password"
            className="h-8.5 px-3.5 text-xs font-semibold pointer-coarse:h-11"
          />
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
    <SettingsCard
      icon={LogIn}
      tone="success"
      body="form"
      title="Sign-in method"
      description="How you sign in to Montara."
    >
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
    </SettingsCard>
  )
}

/** Change the password, only for an account that has one; any other sign-in gets its own card. */
export default function PasswordSettings() {
  const { data, isPending, isError, error } = useQuery(queries.profile.security())

  if (isPending) return <Skeleton className="h-40" />
  if (isError) {
    return (
      <SettingsCard
        icon={LogIn}
        tone="success"
        body="form"
        title="Sign-in method"
        description="How you sign in to Montara."
      >
        <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
      </SettingsCard>
    )
  }

  return (
    <>
      {(data.has_google || !data.has_password) && <SignInMethod security={data} />}
      {data.has_password && (
        <SettingsCard
          icon={KeyRound}
          tone="success"
          body="form"
          title="Change password"
          description="Use a password you don't use anywhere else."
        >
          <PasswordForm />
        </SettingsCard>
      )}
    </>
  )
}
