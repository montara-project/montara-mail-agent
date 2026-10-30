import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import googleLogo from '@/assets/brands/google.svg'
import { ServerURLForm } from '@/components/block/settings/server-url-form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useAppForm } from '@/hooks/form'
import { SignInSchema } from '@/lib/api/dtos/auth/schema'
import { DEFAULT_SERVER_URL, SERVER_URL } from '@/lib/api/server-url'
import { signInWithEmail, verifyTOTP } from '@/lib/auth/email-auth'
import { startGoogleSignIn } from '@/lib/auth/google-auth'
import { COMMUNITY } from '@/lib/constants/edition'
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

/** The line under the title for each screen of the login card. */
const STEP_DESCRIPTIONS = {
  server: 'Choose your Montara server',
  code: 'Two-factor sign-in',
  password: 'Sign in to continue',
}

/** Which screen the login card shows; picking a server wins over the code step. */
function loginStep(pickServer: boolean, needsCode: boolean): keyof typeof STEP_DESCRIPTIONS {
  if (pickServer) return 'server'
  if (needsCode) return 'code'
  return 'password'
}

export default function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  // Set once the password was right but the account asks for a code too.
  const [needsCode, setNeedsCode] = useState(false)
  // Choosing a server here, since an account on a self-hosted one can't reach settings first.
  const [pickServer, setPickServer] = useState(false)
  // Stays set on success: the browser leaves for Google's consent screen.
  const [googleLoading, setGoogleLoading] = useState(false)

  const enter = async () => {
    await router.invalidate()
    await router.navigate({ to: '/dashboard' })
  }

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    try {
      const authUrl = await startGoogleSignIn()
      window.location.assign(authUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
      setGoogleLoading(false)
    }
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
  const step = loginStep(pickServer, needsCode)

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/images/mail-agent-logo.png" alt="" className="size-12" />
          <h1 className="text-xl font-bold">Montara</h1>
          <FieldDescription>{STEP_DESCRIPTIONS[step]}</FieldDescription>
        </div>

        {step === 'server' && <ServerURLForm onCancel={() => setPickServer(false)} />}
        {step === 'code' && <TOTPStep onDone={enter} onBack={() => setNeedsCode(false)} />}
        {step === 'password' && (
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

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">or</span>
              <Separator className="flex-1" />
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={googleLoading}
              onClick={() => void signInWithGoogle()}
            >
              <img src={googleLogo} alt="" className="size-4" />
              {googleLoading ? 'Redirecting...' : 'Login with Google'}
            </Button>
          </form>
        )}
      </FieldGroup>
      {!pickServer && !COMMUNITY && (
        <p className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-1 text-center text-sm">
          Server: <span className="text-foreground">{new URL(SERVER_URL).host}</span>
          {SERVER_URL === DEFAULT_SERVER_URL ? '' : ' (self hosted)'}
          <Button mode="link" underline="solid" onClick={() => setPickServer(true)}>
            Change
          </Button>
        </p>
      )}
    </div>
  )
}
