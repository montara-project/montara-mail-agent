import type { Metadata } from 'next'

import { CONTACT_EMAIL, TIERS } from '@/lib/pricing'
import { pageMetadata } from '@/lib/seo'

import { CurrentPrice, TierPrice } from './tier-price'

export const metadata: Metadata = pageMetadata({
  path: '/pricing',
  title: 'Pricing',
  description:
    'Montara Mail plans: start free with 20 mailboxes and 10M AI tokens a week, upgrade to Pro for unlimited mailboxes and 100M tokens.',
})

/** One tier card: name, price with the promo strike-through, features, CTA. */
function TierCard({ tier, highlighted }: { tier: (typeof TIERS)[number]; highlighted?: boolean }) {
  return (
    <div
      className={`grid content-start gap-4 rounded-xl border bg-card p-6 ${
        highlighted ? 'border-primary shadow-sm ring-1 ring-primary/30' : ''
      }`}
    >
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{tier.name}</h3>
          {highlighted && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Best value
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{tier.tagline}</p>
      </div>
      <TierPrice tier={tier} />
      <ul className="grid gap-2 text-sm text-muted-foreground">
        {tier.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span aria-hidden className="text-primary">
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        {tier.cta.label === 'Contact us' ? (
          <a
            href={tier.cta.href}
            className="border-input bg-background hover:bg-accent inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium"
          >
            Contact us
          </a>
        ) : (
          <a
            href={tier.cta.href}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
          >
            {tier.cta.label}
          </a>
        )}
      </div>
    </div>
  )
}

export default function PricingPage() {
  const [free, proMonthly, proYearly, enterprise] = TIERS
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <header className="mx-auto grid max-w-2xl gap-3 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground">
          Start free, upgrade when your team outgrows it. Paid plans renew from your balance
          automatically and stay cancel-anytime.
        </p>
      </header>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        <TierCard tier={free} />
        <TierCard tier={proMonthly} highlighted />
        <TierCard tier={enterprise} />
      </div>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Prefer yearly? Pro is <CurrentPrice tier={proYearly} /> a year — two months free —{' '}
        <a className="text-foreground underline underline-offset-4" href={proYearly.cta.href}>
          upgrade in the app
        </a>
        .
      </p>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold tracking-tight">Compare plans</h2>
        <div className="border-border mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-120 text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="text-muted-foreground px-4 py-3 font-medium">What you get</th>
                <th className="px-4 py-3 font-medium">Free</th>
                <th className="px-4 py-3 font-medium">Pro</th>
                <th className="px-4 py-3 font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {[
                ['Connected email accounts', '20', 'Unlimited', 'Custom'],
                ['Organizations', '2', '10', 'Custom'],
                ['AI tokens a week', '10M', '100M + pay-as-you-go', 'Custom'],
                ['Support', 'Email (working hours)', 'Email 24/7', 'Dedicated'],
              ].map(([label, free, pro, ent]) => (
                <tr key={label} className="border-border border-t">
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="text-muted-foreground px-4 py-3">{free}</td>
                  <td className="px-4 py-3">{pro}</td>
                  <td className="text-muted-foreground px-4 py-3">{ent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="text-muted-foreground mt-10 grid gap-2 text-sm">
        <p>
          Questions about Enterprise? Write to{' '}
          <a
            className="text-foreground underline underline-offset-4"
            href={`mailto:${CONTACT_EMAIL}`}
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
        <p>
          Paid plans renew from your wallet balance automatically at period end; if the balance
          cannot cover the next period, the plan returns to Free — no surprise charges.
        </p>
      </section>
    </div>
  )
}
