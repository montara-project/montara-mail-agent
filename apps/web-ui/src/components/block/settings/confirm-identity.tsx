import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { signOut } from '@/lib/auth/email-auth'
import { getQueryClient } from '@/lib/providers/react-query'

/**
 * Adding a passkey or an authenticator app asks for the password again. An
 * account without one (Google, Microsoft or a magic link) needs a sign-in in
 * the last 10 minutes instead, which the server checks.
 */
export function ConfirmPasswordField({
  value,
  onChange,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}) {
  const { data } = useQuery(queries.profile.security())
  if (!data) return null
  if (!data.has_password) {
    return (
      <FieldDescription>
        For your security, this works only within 10 minutes of signing in.
      </FieldDescription>
    )
  }
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor="confirm-password">Your password</FieldLabel>
      <Input
        id="confirm-password"
        type="password"
        autoComplete="current-password"
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldDescription>Confirm it's you before adding a new way to sign in.</FieldDescription>
    </Field>
  )
}

/** Toasts a failed confirmation; a session too old to confirm offers a fresh sign-in. */
export function useConfirmIdentityError() {
  const navigate = useNavigate()
  return (error: unknown) => {
    const stale = (error as { response?: { status?: number } })?.response?.status === 403
    toast.error(
      axiosErrorMessage(error),
      stale
        ? {
            action: {
              label: 'Sign in again',
              onClick: async () => {
                await signOut()
                getQueryClient().clear()
                await navigate({ to: '/sign-in', replace: true })
              },
            },
          }
        : undefined
    )
  }
}
