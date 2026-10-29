import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Bot,
  BrainCircuit,
  Building2,
  ChevronRight,
  CreditCard,
  KeyRound,
  Package,
  Plug,
  ShieldBan,
  ShieldCheck,
  Trash2,
  User,
  Wand2,
  Wrench,
} from 'lucide-react'

import SectionCard from '@/components/block/common/section-card'
import { Badge } from '@/components/ui/badge'
import { queries } from '@/lib/api/queries'
import { COMMUNITY } from '@/lib/constants/edition'

/** A page of the Control Center; one without a url isn't built yet and shows as Soon. */
type SettingsItem = { title: string; icon: typeof User; url?: string }

const SETTINGS_GROUPS: { title: string; items: SettingsItem[] }[] = [
  {
    title: 'Account',
    items: [
      { title: 'My Profile', icon: User, url: '/settings/profile' },
      { title: 'Security', icon: ShieldCheck, url: '/settings/security' },
      { title: 'API Keys', icon: KeyRound, url: '/settings/api-keys' },
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
    title: 'Agent tools',
    items: [
      { title: 'AI Providers', icon: BrainCircuit, url: '/settings/ai-providers' },
      { title: 'Agent Bots', icon: Bot, url: '/settings/agent-bots' },
      { title: 'Tools', icon: Wrench },
      { title: 'Skills', icon: Wand2, url: '/settings/skills' },
      { title: 'MCP', icon: Plug, url: '/settings/mcp' },
      { title: 'Plugins', icon: Package },
    ],
  },
  {
    title: 'Danger zone',
    items: [{ title: 'Delete Account', icon: Trash2, url: '/settings/delete-account' }],
  },
]

/** Server-wide settings, shown to a super user only, before the danger zone. */
const PLATFORM_GROUP: { title: string; items: SettingsItem[] } = {
  title: 'Platform',
  items: [{ title: 'IP Block', icon: ShieldBan, url: '/settings/ip-blocks' }],
}

/** The settings index: each group a SectionCard of rows that open their page. */
export default function SettingsNav() {
  const { data: security } = useQuery(queries.profile.security())
  const groups = security?.super_user
    ? [...SETTINGS_GROUPS.slice(0, -1), PLATFORM_GROUP, ...SETTINGS_GROUPS.slice(-1)]
    : SETTINGS_GROUPS

  return (
    <nav aria-label="Control Center" className="grid gap-8">
      {groups.map((group) => (
        <section key={group.title} className="grid gap-2">
          <h2 className="text-muted-foreground text-sm">{group.title}</h2>
          <SectionCard>
            {/* Rows run to the card's edges, so the hover fills the whole row. */}
            <ul className="-m-4 divide-y overflow-hidden rounded-lg">
              {group.items.map((item) => (
                <li key={item.title}>
                  {item.url ? (
                    <Link
                      to={item.url}
                      className="hover:bg-accent/50 focus-visible:bg-accent/50 flex items-center gap-3 px-4 py-3 text-sm outline-none"
                    >
                      <item.icon className="text-muted-foreground size-4 shrink-0" />
                      <span className="flex-1">{item.title}</span>
                      <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                    </Link>
                  ) : (
                    <div
                      aria-disabled
                      className="text-muted-foreground flex items-center gap-3 px-4 py-3 text-sm"
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="flex-1">{item.title}</span>
                      <Badge variant="secondary" appearance="light" size="sm">
                        Soon
                      </Badge>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>
      ))}
    </nav>
  )
}
