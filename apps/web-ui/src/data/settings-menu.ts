import {
  Bot,
  Building2,
  Cpu,
  CreditCard,
  GlobeLock,
  GraduationCap,
  Inbox,
  KeyRound,
  type LucideIcon,
  PanelRight,
  Plug,
  Puzzle,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
  Wrench,
} from 'lucide-react'

import { COMMUNITY } from '@/lib/constants/edition'

// The Control Center's pages, shared by its index and its sidebar so the two
// never disagree on a name, an icon or who can reach a page.

/**
 * A page of the Control Center. One without a url isn't built yet; `soon` marks
 * a page that exists but whose feature isn't open. Both show the Soon badge.
 */
export type SettingsItem = {
  title: string
  meta: string
  icon: LucideIcon
  url?: string
  soon?: boolean
}

export type SettingsGroup = {
  title: string
  icon: LucideIcon
  items: SettingsItem[]
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    title: 'Account',
    icon: User,
    items: [
      { title: 'My Profile', meta: 'Name and avatar', icon: User, url: '/settings/profile' },
      { title: 'Mail', meta: 'Inbox layout and privacy', icon: Inbox, url: '/settings/mail' },
      {
        title: 'Security',
        meta: 'Password, 2FA, activity log',
        icon: ShieldCheck,
        url: '/settings/security',
      },
      { title: 'API Keys', meta: 'Keys and scopes', icon: KeyRound, url: '/settings/api-keys' },
    ],
  },
  {
    title: 'Workspace',
    icon: Building2,
    items: [
      {
        title: 'Organization',
        meta: 'Organizations and audit log',
        icon: Building2,
        url: '/settings/organization',
      },
      // The Community Edition takes no payments.
      ...(COMMUNITY
        ? []
        : [
            {
              title: 'Billing',
              meta: 'Plan, wallet and invoices',
              icon: CreditCard,
              url: '/settings/billing',
            },
          ]),
    ],
  },
  {
    title: 'Agent tools',
    icon: Sparkles,
    items: [
      {
        title: 'Agent Bots',
        meta: 'Custom agents and their instructions',
        icon: Bot,
        url: '/settings/agent-bots',
      },
      {
        title: 'AI Assistant Panel',
        meta: 'Placement in Mail',
        icon: PanelRight,
        url: '/settings/ai-assistant-panel',
      },
      { title: 'Tools', meta: 'Built-in tool permissions', icon: Wrench },
      {
        title: 'Skills',
        meta: 'Reusable playbooks',
        icon: GraduationCap,
        url: '/settings/skills',
      },
      { title: 'MCP', meta: 'Model Context servers', icon: Plug, url: '/settings/mcp' },
      {
        title: 'Plugins',
        meta: 'Third-party extensions',
        icon: Puzzle,
        url: '/settings/plugins',
        soon: true,
      },
    ],
  },
]

/** Server-wide settings, shown to a super user only, before the danger zone. */
export const PLATFORM_GROUP: SettingsGroup = {
  title: 'Platform',
  icon: Server,
  items: [
    {
      title: 'AI Providers',
      meta: 'Models and API credentials',
      icon: Cpu,
      url: '/settings/ai-providers',
    },
    { title: 'IP Block', meta: 'Blocked addresses', icon: GlobeLock, url: '/settings/ip-blocks' },
  ],
}

export const DANGER_GROUP: SettingsGroup = {
  title: 'Danger zone',
  icon: TriangleAlert,
  items: [
    {
      title: 'Delete Account',
      meta: 'Permanent · removes mailboxes, messages and API keys',
      icon: Trash2,
      url: '/settings/delete-account',
    },
  ],
}
