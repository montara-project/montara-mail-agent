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
  { label: '+2 more', dot: 'bg-zinc-600' },
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
                ? 'inline-flex items-center gap-1.5 rounded-chip border border-accent-ink/40 bg-accent-tint px-[9px] py-1'
                : 'inline-flex items-center gap-1.5 rounded-chip border border-transparent px-[9px] py-1'
            }
          >
            {done ? (
              <Check className="size-2 text-success" aria-hidden />
            ) : active ? (
              <span className="size-[5px] rounded-full bg-accent-ink" aria-hidden />
            ) : (
              <span className="font-mono text-[9px] font-semibold text-zinc-600">{item.n}</span>
            )}
            <span
              className={
                active
                  ? 'font-mono text-[9px] font-bold text-foreground'
                  : 'font-mono text-[9px] font-semibold text-ink-3'
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
      <aside className="relative hidden w-[560px] shrink-0 flex-col justify-between overflow-hidden border-r border-border bg-gradient-to-b from-[#15151c] to-[#0a0a0c] px-11 pt-11 pb-10 lg:flex">
        <div
          className="absolute -top-40 -left-44 size-[560px] rounded-full bg-[radial-gradient(closest-side,#7c7cff2e,#7c7cff00)]"
          aria-hidden
        />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid size-[30px] place-items-center rounded-[9px] border border-accent-ink/25 bg-accent-tint">
              <Mail className="size-[15px] text-[#c7c7ff]" aria-hidden />
            </div>
            <span className="text-[13px] font-bold">Montara Mail</span>
          </div>
          <span className="font-mono text-[9px] font-semibold text-zinc-600">{EDITION_LABEL}</span>
        </div>

        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-[7px]">
            <span className="font-mono text-[9.5px] font-semibold text-[#c7c7ff]">
              {pitch.eyebrow}
            </span>
            <span className="size-[3px] rounded-full bg-zinc-600" aria-hidden />
            <span className="font-mono text-[9.5px] font-semibold text-zinc-600">
              {pitch.kicker}
            </span>
          </div>
          <h2 className="text-[34px] font-bold leading-[1.15]">{pitch.headline}</h2>
          <p className="text-[13px] leading-[1.6] text-ink-3">{pitch.sub}</p>
          {view === 'verify' ? (
            <div className="mt-2 flex flex-col gap-2.5 border-t border-border pt-[18px]">
              {pitch.assurance.map((line) => (
                <div key={line} className="flex items-center gap-2">
                  <Check className="size-3 shrink-0 text-[#c7c7ff]" aria-hidden />
                  <p className="text-[11.5px] text-ink-3">{line}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {pitch.providers.map((provider) => (
                <span
                  key={provider.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground"
                >
                  <span className={cn('size-1.5 rounded-full', provider.dot)} aria-hidden />
                  {provider.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {view === 'verify' ? (
          <p className="relative font-mono text-[9.5px] text-zinc-600">
            Montara Mail · {EDITION_LABEL} inbox
          </p>
        ) : (
          <div className="relative flex justify-between border-t border-border pt-4">
            {pitch.trust.map((line) => (
              <div key={line} className="flex items-center gap-1.5">
                <Check className="size-[11px] shrink-0 text-[#c7c7ff]" aria-hidden />
                <span className="font-mono text-[9px] font-semibold text-zinc-600">{line}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Right / sign-in: the stepper, the card and the legal lines. */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-10 py-10 lg:px-[60px]">
        <span className="absolute top-10 right-10 font-mono text-[9.5px] font-semibold text-zinc-600 lg:right-[60px]">
          Jakarta · EN
        </span>
        {exchanging ? (
          <div role="status" className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="text-muted-foreground size-6 animate-spin" />
            <p className="text-muted-foreground text-sm">Finishing Google sign-in…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-[18px]">
            <Stepper step={authStep} />
            <LoginForm codeFirst={needsCode} onStepChange={setAuthStep} />
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-[11px] text-zinc-600">
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
              <p className="text-[11px] text-zinc-600">
                Lost access? Ask your workspace admin to reset the mailbox.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
