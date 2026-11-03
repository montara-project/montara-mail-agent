import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Check, Loader2, Mail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import LoginForm, { type AuthStep } from '@/components/block/auth/login-form'
import { completeGoogleSignIn } from '@/lib/auth/google-auth'
import { redirectIfAuthenticated } from '@/lib/auth/handler'
import { COMMUNITY } from '@/lib/constants/edition'
import { cn } from '@/lib/utils'

const TERMS_URL = 'https://www.montaramail.web.id/terms'
const PRIVACY_URL = 'https://www.montaramail.web.id/privacy'

/** The edition label the design shows next to the brand and on the left foot. */
const EDITION_LABEL = COMMUNITY ? 'self-hosted' : 'cloud'

/** The right panel's three steps; step 3 is the signed-in inbox, never a page here. */
const STEPS = [
  { n: '1', label: 'Email' },
  { n: '2', label: 'Verify' },
  { n: '3', label: 'Inbox' },
]

const PROVIDERS = [
  { label: 'Gmail', dot: 'bg-brand-gmail' },
  { label: 'Outlook', dot: 'bg-brand-outlook' },
  { label: 'Proton', dot: 'bg-brand-proton' },
  { label: '+2 more', dot: 'bg-ink-faint' },
]

/** The left panel's story, per card step. Server picking reuses the identify story. */
function leftPitch(step: AuthStep) {
  if (step === 'verify') {
    return {
      eyebrow: 'Sign-in flow',
      kicker: 'step 2 of 3',
      headline: 'Your authenticator app has the code.',
      sub: 'Enter the rotating code from your authenticator app — or one of your backup codes — to finish signing in.',
      providers: [],
      assurance: [
        'Codes rotate every 30 seconds and are never stored',
        'One sign-in covers every mailbox you connect',
      ],
      trust: [],
    }
  }
  return {
    eyebrow: 'ONE SIGN IN',
    kicker: 'Gmail, Outlook & IMAP',
    headline: 'Every mailbox lands in the same inbox.',
    sub: 'Sign in once and Montara keeps Gmail, Outlook and Proton side by side — searchable, tagged, and readable by your agents.',
    providers: PROVIDERS,
    assurance: [],
    trust: COMMUNITY
      ? ['self-hosted', 'encrypted at rest', 'two-factor ready']
      : ['encrypted at rest', 'two-factor ready', 'open api'],
  }
}

export const Route = createFileRoute('/sign-in/')({
  // via=google is the address Google's callback returns the browser to (see
  // google-auth.ts): the sign-in page then trades the fresh session cookie
  // for a token pair. The API adds totp=1 for a user with two-factor sign-in,
  // who has no session yet: the code step comes first and returns the tokens.
  validateSearch: (search: Record<string, unknown>): { via?: string; totp?: number } => ({
    via: typeof search.via === 'string' ? search.via : undefined,
    // The query arrives as a string; compare loosely so ?totp=1 matches.
    totp: search.totp == 1 ? 1 : undefined,
  }),
  beforeLoad: () => redirectIfAuthenticated('/dashboard'),
  component: RouteComponent,
})

/** The 1-2-3 chips above the card; the active step gets the violet chip. */
function Stepper({ step }: { step: AuthStep }) {
  const view = step === 'server' ? 'identify' : step
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((item, index) => {
        const done = view === 'verify' && index === 0
        const active = (view === 'identify' && index === 0) || (view === 'verify' && index === 1)
        return (
          <div
            key={item.label}
            className={
              active
                ? 'inline-flex items-center gap-1.5 rounded-chip border border-accent-ink/40 bg-accent-tint px-[0.5625rem] py-1'
                : 'inline-flex items-center gap-1.5 rounded-chip border border-transparent px-[0.5625rem] py-1'
            }
          >
            {done ? (
              <Check className="size-2 text-success" aria-hidden />
            ) : active ? (
              <span className="size-[0.3125rem] rounded-full bg-accent-ink" aria-hidden />
            ) : (
              <span className="font-mono text-[0.6875rem] font-semibold text-ink-faint">
                {item.n}
              </span>
            )}
            <span
              className={
                active
                  ? 'font-mono text-[0.6875rem] font-bold text-foreground'
                  : 'font-mono text-[0.6875rem] font-semibold text-ink-3'
              }
            >
              {item.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RouteComponent() {
  const { via, totp } = Route.useSearch()
  const needsCode = via === 'google' && totp === 1
  const router = useRouter()
  const [exchanging, setExchanging] = useState(false)
  // The card reports its step so the split chrome follows it.
  const [authStep, setAuthStep] = useState<AuthStep>('identify')
  // Once per visit: a failed exchange is not retried on every render.
  const attempted = useRef(false)

  useEffect(() => {
    if (via !== 'google' || needsCode || attempted.current) return
    attempted.current = true
    setExchanging(true)

    completeGoogleSignIn()
      .then(async () => {
        await router.invalidate()
        await router.navigate({ to: '/dashboard', replace: true })
      })
      .catch(() => {
        // The consent was abandoned, or the callback's session cookie stayed
        // on the API's origin; the cause isn't knowable here.
        toast.error("Google sign-in didn't finish. Try again, or log in with your email.")
      })
      .finally(() => setExchanging(false))
  }, [via, needsCode, router])

  const pitch = leftPitch(authStep === 'server' ? 'identify' : authStep)
  const view = authStep === 'server' ? 'identify' : authStep

  return (
    <main className="flex min-h-svh bg-background">
      {/* Left / product proof: the brand, the pitch and the trust line. */}
      <aside className="relative hidden w-[35rem] shrink-0 flex-col justify-between overflow-hidden border-r border-border bg-gradient-to-b from-card to-background px-11 pt-11 pb-10 lg:flex">
        <div
          className="absolute -top-40 -left-44 size-[35rem] rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent-ink)_18%,transparent),transparent)]"
          aria-hidden
        />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-[1.875rem] place-items-center rounded-[0.5625rem] border border-accent-ink/25 bg-accent-tint">
              <Mail className="size-[0.9375rem] text-accent-soft" aria-hidden />
            </div>
            <span className="text-[0.875rem] font-bold">Montara Mail</span>
          </div>
          <span className="font-mono text-[0.6875rem] font-semibold text-ink-faint">
            {EDITION_LABEL}
          </span>
        </div>

        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-[0.4375rem]">
            <span className="font-mono text-[0.6875rem] font-semibold text-accent-soft">
              {pitch.eyebrow}
            </span>
            <span className="size-[0.1875rem] rounded-full bg-ink-faint" aria-hidden />
            <span className="font-mono text-[0.6875rem] font-semibold text-ink-faint">
              {pitch.kicker}
            </span>
          </div>
          <h2 className="text-[2.125rem] font-bold leading-[1.15]">{pitch.headline}</h2>
          <p className="text-[0.875rem] leading-[1.6] text-ink-3">{pitch.sub}</p>
          {view === 'verify' ? (
            <div className="mt-2 flex flex-col gap-2.5 border-t border-border pt-[1.125rem]">
              {pitch.assurance.map((line) => (
                <div key={line} className="flex items-center gap-2">
                  <Check className="size-3 shrink-0 text-accent-soft" aria-hidden />
                  <p className="text-[0.78125rem] text-ink-3">{line}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pitch.providers.map((provider) => (
                <span
                  key={provider.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[0.71875rem] font-semibold text-muted-foreground"
                >
                  <span className={cn('size-1.5 rounded-full', provider.dot)} aria-hidden />
                  {provider.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {view === 'verify' ? (
          <p className="relative font-mono text-[0.6875rem] text-ink-faint">
            Montara Mail · {EDITION_LABEL} inbox
          </p>
        ) : (
          <div className="relative flex justify-between border-t border-border pt-4">
            {pitch.trust.map((line) => (
              <div key={line} className="flex items-center gap-1.5">
                <Check className="size-[0.6875rem] shrink-0 text-accent-soft" aria-hidden />
                <span className="font-mono text-[0.6875rem] font-semibold text-ink-faint">
                  {line}
                </span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Right / sign-in: the stepper, the card and the legal lines. */}
      <section className="relative flex min-w-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-10 lg:px-[3.75rem]">
        <span className="absolute top-10 right-10 font-mono text-[0.6875rem] font-semibold text-ink-faint lg:right-[3.75rem]">
          Jakarta · EN
        </span>
        {exchanging ? (
          <div role="status" className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
            <p className="text-muted-foreground text-sm">Finishing Google sign-in…</p>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-[1.125rem]">
            <Stepper step={authStep} />
            <LoginForm codeFirst={needsCode} onStepChange={setAuthStep} />
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-[0.75rem] text-ink-faint">
                By continuing you agree to the{' '}
                <a
                  href={TERMS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-muted-foreground"
                >
                  Terms
                </a>{' '}
                and the{' '}
                <a
                  href={PRIVACY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-muted-foreground"
                >
                  Privacy Policy
                </a>
                .
              </p>
              <p className="text-[0.75rem] text-ink-faint">
                Lost access? Ask your workspace admin to reset the mailbox.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
