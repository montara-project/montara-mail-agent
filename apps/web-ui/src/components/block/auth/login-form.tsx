import { IconBox } from '@tabler/icons-react'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useAppForm } from '@/hooks/form'
import { SignInSchema } from '@/lib/api/dtos/auth/schema'
import { signInWithEmail, verifyTOTP } from '@/lib/auth/email-auth'
import { cn } from '@/lib/utils'

/**
 * The second step for a user with two-factor sign-in: a code from the
 * authenticator app, or one of the backup codes.
 */
function TOTPStep({ onDone, onBack }: { onDone: () => Promise<void>; onBack: () => void }) {
  const [code, setCode] = useState('')
  const [backup, setBackup] = useState(false)
  const [trust, setTrust] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const submit = async () => {
    setIsLoading(true)
    try {
      await verifyTOTP({ code: code.trim(), trust_device: trust }, backup)
      await onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) void submit()
      }}
    >
      <Field>
        <FieldLabel htmlFor="totp-code">
          {backup ? 'Backup code' : 'Authentication code'}
        </FieldLabel>
        <Input
          id="totp-code"
          variant="lg"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="one-time-code"
          inputMode={backup ? 'text' : 'numeric'}
          maxLength={backup ? 32 : 6}
          placeholder={backup ? 'One of your saved backup codes' : '6-digit code'}
        />
        <FieldDescription>
          {backup
            ? 'Each backup code works once.'
            : 'Open your authenticator app and enter the code it shows for Montara.'}
        </FieldDescription>
      </Field>
      <div className="flex items-center gap-2">
        <Checkbox id="totp-trust" checked={trust} onCheckedChange={(v) => setTrust(v === true)} />
        <label htmlFor="totp-trust" className="text-sm">
          Trust this browser for 30 days
        </label>
      </div>
      <Field>
        <Button type="submit" disabled={isLoading || !code.trim()}>
          {isLoading ? 'Verifying...' : 'Verify'}
        </Button>
        <div className="flex justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            Back
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setBackup(!backup)
              setCode('')
            }}
          >
            {backup ? 'Use the app code' : 'Use a backup code'}
          </Button>
        </div>
      </Field>
    </form>
  )
}

export default function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  // Set once the password was right but the account asks for a code too.
  const [needsCode, setNeedsCode] = useState(false)

  const enter = async () => {
    await router.invalidate()
    await router.navigate({ to: '/dashboard' })
  }

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: '',
    },
    validators: {
      onSubmit: SignInSchema,
      onChange: SignInSchema,
    },
    onSubmit: async ({ value }) => {
      setIsLoading(true)

      try {
        const res = await signInWithEmail(value)
        if (res && 'totp_redirect' in res) {
          setNeedsCode(true)
          return
        }
        await enter()
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    },
  })

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-8 items-center justify-center rounded-md">
            <IconBox className="size-6" />
          </div>
          <h1 className="text-xl font-bold">Vine</h1>
          <FieldDescription>
            {needsCode ? 'Two-factor sign-in' : 'Sign in to continue'}
          </FieldDescription>
        </div>

        {needsCode ? (
          <TOTPStep onDone={enter} onBack={() => setNeedsCode(false)} />
        ) : (
          <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <form.AppField
              name="email"
              children={(field) => (
                <field.TextField label="Email" placeholder="type your email" asterisk />
              )}
            />

            <form.AppField
              name="password"
              children={(field) => (
                <field.PasswordField label="Password" placeholder="type your password" asterisk />
              )}
            />

            <Field>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Login'}
              </Button>
            </Field>
          </form>
        )}
      </FieldGroup>
    </div>
  )
}
