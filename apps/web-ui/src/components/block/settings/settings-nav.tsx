import { Link } from '@tanstack/react-router'
import { Building2, CreditCard, ShieldCheck, Trash2, User } from 'lucide-react'

const SETTINGS_ITEMS = [
  { title: 'My Profile', icon: User, url: '/settings/profile' },
  { title: 'Security', icon: ShieldCheck, url: '/settings/security' },
  { title: 'Organization', icon: Building2, url: '/settings/organization' },
  { title: 'Billing', icon: CreditCard, url: '/settings/billing' },
  { title: 'Delete Account', icon: Trash2, url: '/settings/delete-account' },
] as const

/** The settings pages: a column beside the page, a scrolling row on phones. */
export default function SettingsNav() {
  return (
    <nav
      aria-label="Settings"
      className="-mx-4 overflow-x-auto px-4 md:sticky md:top-20 md:mx-0 md:overflow-visible md:px-0"
    >
      <ul className="flex gap-1 md:flex-col">
        {SETTINGS_ITEMS.map((item) => (
          <li key={item.url} className="shrink-0">
            <Link
              to={item.url}
              className="text-muted-foreground hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground focus-visible:ring-ring/50 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-[3px]"
            >
              <item.icon className="size-4 shrink-0" />
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
