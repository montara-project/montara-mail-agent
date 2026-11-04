import { type AnyFieldApi, useSelector } from '@tanstack/react-form'
import { useRouter } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { toast } from 'sonner'

import googleLogo from '@/assets/brands/google.svg'
import outlookLogo from '@/assets/connectors/outlook.svg'
import { ServerURLForm } from '@/components/block/settings/server-url-form'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input, InputWrapper } from '@/components/ui/input'
import { OTPCodeInput } from '@/components/ui/input-otp'
import { useAppForm } from '@/hooks/form'
import { SignInSchema } from '@/lib/api/dtos/auth/schema'
import { signInWithEmail, verifyTOTP } from '@/lib/auth/email-auth'
import { type OAuthProvider, startOAuthSignIn } from '@/lib/auth/oauth-sign-in'
import { cn } from '@/lib/utils'

/** The provider buttons above the email form, in order. */
const OAUTH_BUTTONS: { provider: OAuthProvider; label: string; logo: string }[] = [
  { provider: 'google', label: 'Continue with Google', logo: googleLogo },
  { provider: 'microsoft', label: 'Continue with Outlook', logo: outlookLogo },
]

/** The email last signed in with on this browser, offered again on the card. */
const LAST_EMAIL_KEY = 'auth.lastEmail'

/**
 * The provider dot for a chip: the mailbox domain's brand color, so the chip
 * reads like the account rows elsewhere in the app.
 */
function providerDotClass(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (/^(gmail|googlemail)\.com$/.test(domain)) return 'bg-brand-gmail'
  if (/(outlook|hotmail|live|msn)\./.test(domain)) return 'bg-brand-outlook'
  if (/^(proton\.(me|mail\.com))$/.test(domain)) return 'bg-brand-proton'
  if (/yahoo\./.test(domain)) return 'bg-brand-yahoo'
  if (/(icloud|me|mac)\.com$/.test(domain)) return 'bg-brand-icloud'
  return 'bg-ink-faint'
}

/**
 * The field's errors once they're worth showing: form-wide validators flag
 * every field on the first keystroke, so a field stays quiet until it's left
 * or the form is submitted. The prop-based variant of `useVisibleFieldErrors`:
 * fields rendered in a form.Field render prop have no field context.
 */
function useFieldErrors(field: AnyFieldApi) {
  const errors = useSelector(field.store, (state) => state.meta.errors)
  const blurred = useSelector(field.store, (state) => state.meta.isBlurred)
  const submitted = useSelector(field.form.store, (state) => state.submissionAttempts > 0)
  return blurred || submitted ? errors : []
}

/**
 * The card's text field: the design's compact label, a leading icon and a
 * 42px field. It takes the field API as a prop so it can render inside a
 * form.Field render prop.
 */
function AuthField({
  field,
  label,
  icon: Icon,
  ...input
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  field: AnyFieldApi
  label: string
  icon?: LucideIcon
}) {
  const errors = useFieldErrors(field)
  const isInvalid = errors.length > 0

  return (
    <Field data-invalid={isInvalid} className="gap-1.5">
      <FieldLabel
        htmlFor={field.name}
        className="text-[0.78125rem] font-semibold text-muted-foreground"
      >
        {label}
      </FieldLabel>
      <InputWrapper className="h-[2.625rem] gap-[0.5625rem] px-3">
        {Icon && <Icon className="size-3.5 text-ink-faint" />}
        <Input
          id={field.name}
          name={field.name}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          aria-invalid={isInvalid || undefined}
          variant="lg"
          className="text-[0.875rem]"
          {...input}
        />
      </InputWrapper>
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  )
}

/**
 * The password field: the same field style, with the show/hide eye.
 */
function AuthPasswordField({
  field,
  label,
  ...input
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  field: AnyFieldApi
  label: string
}) {
  const errors = useFieldErrors(field)
  const [visible, setVisible] = useState(false)
  const isInvalid = errors.length > 0

  return (
    <Field data-invalid={isInvalid} className="gap-1.5">
      <FieldLabel
        htmlFor={field.name}
        className="text-[0.78125rem] font-semibold text-muted-foreground"
      >
        {label}
      </FieldLabel>
      <InputWrapper className="h-[2.625rem] px-3">
        <Input
          type={visible ? 'text' : 'password'}
          id={field.name}
          name={field.name}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          aria-invalid={isInvalid || undefined}
          autoComplete="current-password"
          variant="lg"
          className="text-[0.875rem]"
          {...input}
        />
        {/* The ::after grows the 14px eye to a 44px tap target without moving it. */}
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground relative after:absolute after:-inset-3.5"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </InputWrapper>
      {isInvalid && <FieldError errors={errors} />}
    </Field>
  )
}

/**
 * The second step for a user with two-factor sign-in: a rotating code from
 * the authenticator app, or one of the backup codes.
 */
function TOTPStep({
  onDone,
  onBack,
  backup,
}: {
  onDone: () => Promise<void>
  onBack: () => void
  backup: boolean
}) {
  const [code, setCode] = useState('')
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
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) void submit()
      }}
    >
      {/* The design's autofill banner. App codes can't be fetched from an
          inbox, so it stays a paste hint: OTPCodeInput splits a pasted code. */}
      {!backup && (
        <div className="flex items-center gap-2 rounded-md border border-accent-ink/40 bg-accent-tint px-[0.6875rem] py-[0.5625rem]">
          <Sparkles className="size-3 shrink-0 text-accent-soft" aria-hidden />
          <p className="text-[0.78125rem] text-accent-soft">
            Paste the code — Montara fills each digit for you.
          </p>
        </div>
      )}
      <Field className="gap-1.5">
        {/* The visible label is the card head's title; this stays for screen readers. */}
        <FieldLabel htmlFor="totp-code" className="sr-only">
          {backup ? 'Backup code' : 'Authentication code'}
        </FieldLabel>
        {backup ? (
          <Input
            id="totp-code"
            variant="lg"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            autoComplete="one-time-code"
            maxLength={32}
            placeholder="One of your saved backup codes"
          />
        ) : (
          <OTPCodeInput id="totp-code" value={code} onChange={setCode} autoFocus />
        )}
      </Field>
      <Button
        type="submit"
        className="h-11 w-full text-[0.875rem] font-bold"
        disabled={!code.trim() || isLoading}
      >
        {isLoading ? 'Verifying…' : 'Verify and continue'}
        {!isLoading && <ArrowRight className="size-3.5" />}
      </Button>
      <div className="flex items-center gap-2">
        <Checkbox id="totp-trust" checked={trust} onCheckedChange={(v) => setTrust(v === true)} />
        <label htmlFor="totp-trust" className="text-[0.75rem] text-ink-3">
          Trust this browser for 30 days
        </label>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full text-[0.8125rem] font-semibold text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="size-3.5" />
        Back to sign-in
      </Button>
    </form>
  )
}

/** The line under the title for each screen of the login card. */
const STEP_DESCRIPTIONS = {
  server: 'Choose your Montara server',
  password:
    'One inbox for every mailbox you own — sign in with email, Google, Outlook, or a two-factor code.',
}

/** Which screen the login card shows; picking a server wins over the code step. */
function loginStep(
  pickServer: boolean,
  needsCode: boolean
): keyof typeof STEP_DESCRIPTIONS | 'code' {
  if (pickServer) return 'server'
  if (needsCode) return 'code'
  return 'password'
}

export type AuthStep = 'identify' | 'verify' | 'server'

export default function LoginForm({
  className,
  codeFirst = false,
  onStepChange,
  ...props
}: React.ComponentProps<'div'> & {
  /** Start at the code step: Google or Microsoft already vouched for the user. */
  codeFirst?: boolean
  /** The split page chrome (left panel, stepper) follows the card's step. */
  onStepChange?: (step: AuthStep) => void
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  // Set once the password was right but the account asks for a code too.
  const [needsCode, setNeedsCode] = useState(codeFirst)
  // Choosing a server here, since an account on a self-hosted one can't reach settings first.
  const [pickServer, setPickServer] = useState(false)
  // Stays set on success: the browser leaves for the provider's consent screen.
  const [redirecting, setRedirecting] = useState<OAuthProvider | null>(null)
  // The email form's password field: hidden until "Continue with email" is used.
  const [showPassword, setShowPassword] = useState(false)
  // The verify step alternates between the app code and a backup code.
  const [backup, setBackup] = useState(false)
  // The email this browser last signed in with, offered as a chip on the card.
  const [lastEmail] = useState(() => {
    try {
      return localStorage.getItem(LAST_EMAIL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  // MotionConfig's reducedMotion leaves height animating, so the duration drops instead.
  const reduceMotion = useReducedMotion()
  const changeServer = useRef<HTMLButtonElement>(null)

  const enter = async () => {
    const email = form.state.values.email.trim()
    if (email) {
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email)
      } catch {
        // Private mode; the chip is a convenience, not a requirement.
      }
    }
    await router.invalidate()
    await router.navigate({ to: '/dashboard' })
  }

  const signInWith = async (provider: OAuthProvider) => {
    setRedirecting(provider)
    try {
      const authUrl = await startOAuthSignIn(provider)
      window.location.assign(authUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred')
      setRedirecting(null)
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

  useEffect(() => {
    onStepChange?.(step === 'password' ? 'identify' : step === 'code' ? 'verify' : 'server')
  }, [step, onStepChange])

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-card',
        'w-full',
        step === 'code' ? 'max-w-[28.75rem]' : 'max-w-[27.5rem]',
        className
      )}
      {...props}
    >
      {step === 'code' ? (
        <div className="flex flex-col gap-2.5 px-8 pt-[1.875rem] pb-[1.375rem]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[0.6875rem] font-semibold text-accent-soft">
              VERIFICATION
            </span>
            {/* Only an app code rotates; a backup code works once, whenever. */}
            {!backup && (
              <span className="inline-flex items-center gap-1 rounded-chip bg-warning/10 px-2 py-[0.1875rem]">
                <Clock3 className="size-2.5 text-warning" aria-hidden />
                <span className="font-mono text-[0.6875rem] font-semibold text-warning">
                  Rotates every 30 s
                </span>
              </span>
            )}
          </div>
          <h1 className="text-[1.6875rem] font-bold tracking-[-0.025rem]">
            {backup ? 'Enter a backup code' : 'Enter your 6-digit code'}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-[0.84375rem]">
            <span className="text-ink-3">Code from</span>
            <span className="font-bold text-ink-strong">
              {backup ? 'Backup code' : 'your authenticator app'}
            </span>
            <button
              type="button"
              onClick={() => setBackup(!backup)}
              className="cursor-pointer font-semibold text-accent-soft underline-offset-2 hover:underline"
            >
              {backup ? 'Use the app code' : 'Use a backup code'}
            </button>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-[1.625rem] pt-[1.625rem] pb-[1.125rem]">
          <span className="font-mono text-[0.6875rem] font-semibold text-accent-soft">
            WELCOME BACK
          </span>
          <h1 className="text-[1.625rem] font-bold tracking-[-0.025rem]">Sign in to your inbox</h1>
          <p className="text-[0.84375rem] leading-[1.5] text-ink-3">{STEP_DESCRIPTIONS[step]}</p>
        </div>
      )}
      <div
        className={cn(
          'flex flex-col gap-3.5 px-[1.625rem] pb-[1.375rem]',
          step === 'code' && 'px-8 pb-6'
        )}
      >
        {step === 'server' && (
          <ServerURLForm
            autoFocus
            onCancel={() => {
              flushSync(() => setPickServer(false))
              changeServer.current?.focus()
            }}
          />
        )}
        {step === 'password' && (
          <>
            {OAUTH_BUTTONS.map(({ provider, label, logo }) => (
              <Button
                key={provider}
                type="button"
                variant="secondary"
                className="h-11 w-full gap-2 rounded-[0.625rem] border border-border bg-muted text-[0.84375rem] font-semibold shadow-none"
                disabled={redirecting !== null}
                onClick={() => void signInWith(provider)}
              >
                <span className="grid size-[1.125rem] place-items-center rounded-[0.3125rem] bg-white">
                  <img src={logo} alt="" className="size-4" />
                </span>
                {redirecting === provider ? 'Redirecting…' : label}
              </Button>
            ))}
            <div className="flex items-center gap-2.5" aria-hidden>
              <span className="h-px grow bg-border" />
              <span className="font-mono text-[0.6875rem] font-semibold text-ink-faint">or</span>
              <span className="h-px grow bg-border" />
            </div>
            <form
              className="flex flex-col gap-3.5"
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                // "Continue with email" reveals the password; the next press signs in.
                if (!showPassword) {
                  flushSync(() => setShowPassword(true))
                  document.getElementById('password')?.focus()
                } else {
                  form.handleSubmit()
                }
              }}
            >
              <form.Field name="email">
                {(field) => (
                  <AuthField
                    field={field}
                    label="Email address"
                    icon={Mail}
                    type="email"
                    autoComplete="username"
                    placeholder="hello@montaramail.web.id"
                  />
                )}
              </form.Field>
              <LazyMotion features={domAnimation}>
                <AnimatePresence initial={false}>
                  {showPassword && (
                    // The side padding keeps overflow-hidden from clipping the focus rings.
                    <m.div
                      className="-mx-1 overflow-hidden px-1"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.2, 0, 0, 1] }}
                    >
                      <form.Field name="password">
                        {(field) => <AuthPasswordField field={field} label="Password" autoFocus />}
                      </form.Field>
                    </m.div>
                  )}
                </AnimatePresence>
              </LazyMotion>
              <Button
                type="submit"
                className="h-11 w-full rounded-[0.625rem] text-[0.875rem] font-bold"
              >
                {isLoading ? 'Signing in…' : showPassword ? 'Sign in' : 'Continue with email'}
                {!showPassword && !isLoading && <ArrowRight className="size-3.5" />}
              </Button>
            </form>
            {lastEmail && (
              <div className="flex flex-col gap-[0.4375rem] border-t border-border pt-2">
                <span className="font-mono text-[0.6875rem] font-semibold text-ink-faint">
                  Recently used
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      form.setFieldValue('email', lastEmail)
                      document.getElementById('email')?.focus()
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[0.71875rem] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className={cn('size-1.5 rounded-full', providerDotClass(lastEmail))} />
                    {lastEmail}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {step === 'code' && (
          // The key remounts the step when the mode flips, so a code left from
          // the other mode can't fail verification.
          <TOTPStep
            key={backup ? 'backup' : 'app'}
            backup={backup}
            onDone={enter}
            onBack={() => {
              flushSync(() => setNeedsCode(false))
              document.getElementById('password')?.focus()
            }}
          />
        )}
      </div>
      {step === 'code' ? (
        <div className="flex items-center gap-2 border-t border-border bg-secondary/50 px-8 py-[0.8125rem]">
          <Shield className="size-[0.6875rem] shrink-0 text-ink-faint" aria-hidden />
          <p className="font-mono text-[0.6875rem] text-ink-faint">
            Codes are verified by your server and never stored.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-border bg-secondary/50 px-[1.625rem] py-3">
          <Lock className="size-[0.6875rem] shrink-0 text-ink-faint" aria-hidden />
          <p className="font-mono text-[0.6875rem] text-ink-faint">
            Sent only to your server — encrypted in transit.
          </p>
        </div>
      )}
    </div>
  )
}
