import {
  IconArrowRight,
  IconBrandGmail,
  IconBrandYahoo,
  IconChevronDown,
  IconFeather,
  IconInbox,
  IconMail,
  IconPlug,
  IconServer,
  IconSparkles,
  IconTag,
  IconWriting,
} from '@tabler/icons-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Brand tints only; no third-party logos are bundled.
const providers = [
  {
    name: 'Gmail',
    icon: IconBrandGmail,
    color: '#EA4335',
    text: 'Personal Gmail and Google Workspace accounts.',
  },
  {
    name: 'Outlook',
    icon: IconMail,
    color: '#0F78D4',
    text: 'Outlook.com and Microsoft 365 mailboxes.',
  },
  {
    name: 'Yahoo',
    icon: IconBrandYahoo,
    color: '#7B3FE4',
    text: 'Yahoo Mail accounts, alongside the rest.',
  },
  { name: 'Lark', icon: IconFeather, color: '#3370FF', text: 'Lark Mail for your team workspace.' },
  {
    name: 'Other IMAP',
    icon: IconServer,
    color: 'currentColor',
    text: 'Any provider that supports IMAP and SMTP.',
  },
]

const labelStyles = {
  'Needs reply': 'bg-info-bg text-info',
  Invoice: 'bg-warning-bg text-warning',
  Meeting: 'bg-success-bg text-success',
  Newsletter: 'bg-muted text-muted-foreground',
}

type Label = keyof typeof labelStyles

const messages: { from: string; via: string; subject: string; label: Label; time: string }[] = [
  {
    from: 'Sarah Chen',
    via: 'Gmail',
    subject: 'Q4 partnership proposal',
    label: 'Needs reply',
    time: '9:42',
  },
  {
    from: 'Finance Team',
    via: 'Outlook',
    subject: 'Invoice #2048 is due Friday',
    label: 'Invoice',
    time: '9:15',
  },
  {
    from: 'Daniel Park',
    via: 'Lark',
    subject: 'Sync on launch timeline?',
    label: 'Meeting',
    time: '8:57',
  },
  {
    from: 'Product Weekly',
    via: 'Yahoo',
    subject: 'This week in product design',
    label: 'Newsletter',
    time: '7:30',
  },
]

const steps = [
  {
    title: 'Connect your inboxes',
    text: 'Add Gmail, Outlook, Yahoo, Lark, or any IMAP account. Every mailbox syncs into one view.',
  },
  {
    title: 'The agent sorts and summarizes',
    text: 'New mail is labeled by priority and topic, and long threads are condensed into a few lines.',
  },
  {
    title: 'Review the draft and send',
    text: 'The agent writes replies in your tone. You read them, edit if you like, and choose what goes out.',
  },
]

const faqs = [
  {
    q: 'Which email providers can I connect?',
    a: 'Gmail, Outlook, Yahoo, and Lark, plus any other provider that supports IMAP.',
  },
  {
    q: 'Can I connect more than one account?',
    a: 'Yes. Connect as many inboxes as you need and the agent works across all of them in one place.',
  },
  {
    q: 'Does the agent send email on its own?',
    a: 'The agent drafts replies for you to review. You decide what gets sent.',
  },
  {
    q: 'What happens to my email data?',
    a: (
      <>
        We use it only to provide the service and never sell it. Read the{' '}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{' '}
        for details.
      </>
    ),
  },
  {
    q: 'How do I get started?',
    a: 'Get in touch through the contact page and we will set up early access for you.',
  },
]

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string
  title: string
  text: string
}) {
  return (
    <div className="grid gap-6 md:grid-cols-12 md:items-end md:gap-10">
      <div className="md:col-span-7">
        <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase dark:text-info">
          {eyebrow}
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {title}
        </h2>
      </div>
      <p className="text-pretty text-muted-foreground md:col-span-5 md:pb-1.5">{text}</p>
    </div>
  )
}

function Tile({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border bg-card p-6 shadow-xs', className)}>{children}</div>
}

function LabelChip({ label }: { label: Label }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        labelStyles[label]
      )}
    >
      {label}
    </span>
  )
}

function InboxPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-20px_rgb(0_0_0/0.18)]">
      <div className="flex items-center gap-2 border-b bg-muted/60 px-4 py-3">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-3 font-mono text-xs text-muted-foreground">Unified inbox</span>
        <span className="ml-auto rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success">
          5 inboxes synced
        </span>
      </div>

      <div className="grid md:grid-cols-[180px_1fr] lg:grid-cols-[180px_1fr_320px]">
        <aside className="hidden border-r p-3 md:block">
          <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Inboxes</p>
          {providers.map((p) => (
            <div key={p.name} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <p.icon className="size-4" style={{ color: p.color }} />
              <span className="truncate">{p.name}</span>
            </div>
          ))}
        </aside>

        <ul className="divide-y">
          {messages.map((m, i) => (
            <li
              key={m.subject}
              className={cn('flex flex-col gap-1 px-4 py-3', i === 0 && 'bg-info-bg/50')}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{m.from}</span>
                <span className="text-xs text-muted-foreground">via {m.via}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{m.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="truncate text-sm text-muted-foreground">{m.subject}</span>
                <span className="ml-auto">
                  <LabelChip label={m.label} />
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-4 border-t p-4 lg:border-t-0 lg:border-l">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <IconSparkles className="size-4 text-primary dark:text-info" />
            Agent
          </p>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Summary</p>
            <p className="text-sm">
              Sarah proposes a joint campaign for Q4 and asks for a call this week to agree on
              budget.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Draft reply</p>
            <p className="rounded-lg border bg-muted/60 p-3 text-sm">
              Hi Sarah, thanks for sending this over. Thursday at 2pm works for me. I&apos;ll bring
              the budget numbers.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
              Approve &amp; send
            </span>
            <span className="rounded-md border px-3 py-1.5 text-xs font-medium">Edit</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate">
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="absolute -top-[30%] left-1/2 h-[80%] w-[80%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_50%_50%_at_50%_50%,var(--halo-core)_0%,var(--halo-soft)_50%,transparent_85%)] opacity-70 blur-[100px]" />
          <div className="absolute top-[4%] left-[58%] h-[40%] w-[30%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,var(--halo-warm)_0%,transparent_70%)] opacity-50 blur-[90px]" />
        </div>

        <div className="mx-auto max-w-6xl px-6 pt-16 md:pt-24">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium backdrop-blur">
            <IconSparkles className="size-3.5 text-primary dark:text-info" />
            AI agent for your inbox
          </span>
          <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl lg:text-7xl">
            Email management, handled by an AI agent.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">
            Montara Mail brings Gmail, Outlook, Yahoo, Lark, and any IMAP account into one inbox.
            Its AI agent sorts every message, summarizes long threads, and drafts replies for you to
            approve.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/contact">
                Get early access
                <IconArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <span>Works with</span>
            {providers.map((p) => (
              <span key={p.name} className="flex items-center gap-1.5 font-medium text-foreground">
                <p.icon className="size-4" style={{ color: p.color }} />
                {p.name}
              </span>
            ))}
          </div>

          <div className="mt-14 md:mt-20">
            <InboxPreview />
          </div>
        </div>
      </section>

      {/* Providers */}
      <section id="providers" className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <SectionHeading
          eyebrow="Providers"
          title="Every inbox you own, one agent."
          text="Connect personal and work accounts side by side. The agent reads across all of them, so nothing slips through between apps."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {providers.map((p) => (
            <Tile key={p.name} className="flex flex-col gap-4">
              <span className="grid size-11 place-items-center rounded-lg border bg-background">
                <p.icon className="size-6" style={{ color: p.color }} />
              </span>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.text}</p>
              </div>
              <span className="mt-auto flex items-center gap-1.5 text-xs font-medium text-success">
                <IconPlug className="size-3.5" />
                Supported
              </span>
            </Tile>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y bg-card/40">
        <div className="mx-auto max-w-6xl px-6 py-24 md:py-28">
          <SectionHeading
            eyebrow="Features"
            title="Your AI agent works the inbox so you don't have to."
            text="From the first unread message to the reply that closes the thread, the agent does the busywork and leaves the decisions to you."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <Tile>
              <IconTag className="size-5 text-primary dark:text-info" />
              <h3 className="mt-4 font-display text-xl font-semibold">Smart triage</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Every incoming email is labeled by what it needs from you, so the important ones
                rise to the top.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {(Object.keys(labelStyles) as Label[]).map((l) => (
                  <LabelChip key={l} label={l} />
                ))}
              </div>
            </Tile>

            <Tile>
              <IconWriting className="size-5 text-primary dark:text-info" />
              <h3 className="mt-4 font-display text-xl font-semibold">Replies drafted for you</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The agent writes context-aware replies in your tone. Review, tweak, and send in
                seconds.
              </p>
              <p className="mt-6 rounded-lg border bg-muted/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                Hi Daniel, Wednesday morning works. I&apos;ll send a calendar invite for 10:00.
              </p>
            </Tile>

            <Tile>
              <IconSparkles className="size-5 text-primary dark:text-info" />
              <h3 className="mt-4 font-display text-xl font-semibold">Thread summaries</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Catch up on a 30-message thread in three lines: what was decided, what is open, and
                who is waiting.
              </p>
              <ul className="mt-6 space-y-2 text-sm">
                {[
                  'Budget approved at the revised amount',
                  'Design review still open',
                  'Finance is waiting on you',
                ].map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-primary dark:bg-info" />
                    {s}
                  </li>
                ))}
              </ul>
            </Tile>

            <Tile>
              <IconInbox className="size-5 text-primary dark:text-info" />
              <h3 className="mt-4 font-display text-xl font-semibold">One unified inbox</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Read and reply from every connected account in one place, without switching apps or
                tabs.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {providers.map((p) => (
                  <span
                    key={p.name}
                    className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <p.icon className="size-3.5" style={{ color: p.color }} />
                    {p.name}
                  </span>
                ))}
              </div>
            </Tile>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24 md:py-28">
        <SectionHeading
          eyebrow="How it works"
          title="From cluttered to handled in three steps."
          text="Setup takes a few minutes. After that, the agent keeps working as new mail arrives."
        />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Tile className="h-full">
                <span className="font-mono text-sm text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </Tile>
            </li>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-24 md:grid-cols-12 md:py-28">
          <div className="md:col-span-4">
            <p className="font-mono text-xs font-medium tracking-wider text-primary uppercase dark:text-info">
              FAQ
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Frequently asked questions.
            </h2>
          </div>
          <div className="divide-y border-y md:col-span-8">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <IconChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative isolate overflow-hidden rounded-2xl bg-[#111113] px-8 py-16 text-white ring-1 ring-white/10 md:px-16">
          <div
            className="pointer-events-none absolute -top-1/2 left-1/2 -z-10 h-full w-3/4 -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,#2b2f78_0%,transparent_70%)] blur-[80px]"
            aria-hidden="true"
          />
          <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Spend less time in your inbox.
          </h2>
          <p className="mt-4 max-w-xl text-white/70">
            Connect your accounts and let the AI agent handle the sorting, summarizing, and first
            drafts.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/contact">
                Get early access
                <IconArrowRight />
              </Link>
            </Button>
            <Button
              size="lg"

              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
              asChild
            >
              <Link href="#faq">Read the FAQ</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
