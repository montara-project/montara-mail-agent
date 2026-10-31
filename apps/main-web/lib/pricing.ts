/** The pricing page's static data, mirroring the server's plans seeder. */
export interface PricingTier {
  code: string
  name: string
  tagline: string
  amount: number
  interval: 'month' | 'year' | null
  discount: number
  discountEndsAt: string
  features: string[]
  cta: { label: 'Sign in to upgrade' | 'Contact us'; href: string }
}

/** Enterprise contacts the team instead of checking out. */
export const CONTACT_EMAIL = 'hello@montaramail.web.id'

/** End of the launch promo: end of 2026, WIB. */
export const PROMO_ENDS_AT = '2026-12-31T23:59:59+07:00'

export const TIERS: PricingTier[] = [
  {
    code: 'free',
    name: 'Free',
    tagline: 'The essentials for trying the agent.',
    amount: 0,
    interval: null,
    discount: 0,
    discountEndsAt: '',
    features: [
      'Up to 20 connected email accounts',
      'Up to 2 organizations',
      '10M AI tokens a week',
      'Top-up token balance (pay-as-you-go)',
      'Email support (working hours)',
    ],
    cta: { label: 'Sign in to upgrade', href: 'https://app.montaramail.web.id' },
  },
  {
    code: 'pro_monthly',
    name: 'Pro',
    tagline: 'For teams who live in their inbox.',
    amount: 50_000,
    interval: 'month',
    discount: 20_000,
    discountEndsAt: PROMO_ENDS_AT,
    features: [
      'Unlimited connected email accounts',
      '10 organizations',
      '100M AI tokens a week',
      'Top-up token balance (pay-as-you-go)',
      'Email support 24/7',
    ],
    cta: { label: 'Sign in to upgrade', href: 'https://app.montaramail.web.id' },
  },
  {
    code: 'pro_yearly',
    name: 'Pro',
    tagline: 'For teams who live in their inbox. Two months free.',
    amount: 500_000,
    interval: 'year',
    discount: 250_000,
    discountEndsAt: PROMO_ENDS_AT,
    features: [
      'Unlimited connected email accounts',
      '10 organizations',
      '100M AI tokens a week',
      'Top-up token balance (pay-as-you-go)',
      'Email support 24/7',
    ],
    cta: { label: 'Sign in to upgrade', href: 'https://app.montaramail.web.id' },
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    tagline: 'Unlimited everything, billed per contract.',
    amount: 0,
    interval: null,
    discount: 0,
    discountEndsAt: '',
    features: [
      'Unlimited connected email accounts',
      'Unlimited organizations',
      'Unlimited AI tokens',
      'Dedicated support',
      'SSO, invoicing, custom terms',
      'Contact us to get started',
    ],
    cta: { label: 'Contact us', href: 'mailto:hello@montaramail.web.id' },
  },
]
