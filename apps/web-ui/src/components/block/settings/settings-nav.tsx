import { Link } from '@tanstack/react-router'
import { Building2, ChevronRight, CreditCard, ShieldCheck, Trash2, User } from 'lucide-react'

import { COMMUNITY } from '@/lib/constants/edition'

const SETTINGS_GROUPS = [
  {
    title: 'Account',
    items: [
      { title: 'My Profile', icon: User, url: '/settings/profile' },
      { title: 'Security', icon: ShieldCheck, url: '/settings/security' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { title: 'Organization', icon: Building2, url: '/settings/organization' },
      // The Community Edition takes no payments.
      ...(COMMUNITY ? [] : [{ title: 'Billing', icon: CreditCard, url: '/settings/billing' }]),
    ],
  },
  {
    title: 'Danger zone',
    items: [{ title: 'Delete Account', icon: Trash2, url: '/settings/delete-account' }],
  },
] as const

/** The settings index: each group a card of rows that open their page. */
export default function SettingsNav() {
  return (
    <nav aria-label="Settings" className="grid gap-8">
      {SETTINGS_GROUPS.map((group) => (
        <section key={group.title} className="grid gap-2">
          <h2 className="text-muted-foreground text-sm">{group.title}</h2>
          <ul className="bg-card divide-y overflow-hidden rounded-xl border">
            {group.items.map((item) => (
              <li key={item.url}>
                <Link
                  to={item.url}
                  className="hover:bg-accent/50 focus-visible:bg-accent/50 flex items-center gap-3 px-4 py-3 text-sm outline-none"
                >
                  <item.icon className="text-muted-foreground size-4 shrink-0" />
                  <span className="flex-1">{item.title}</span>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}
