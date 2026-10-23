import { format, isToday } from 'date-fns';

export type MailTab = 'focused' | 'archive' | 'others'

export type MailContact = { name: string; email: string }

export type Mail = {
  id: string
  name: string
  email: string
  verified?: boolean
  starred?: boolean
  subject: string
  teaser: string
  body: string
  receivedAt: string
  read: boolean
  tab: MailTab
  cc?: MailContact[]
  /** How the AI ranked this mail, e.g. "very important". */
  importance: string
  attachments?: { name: string; size: string }[]
}

export type MailAccount = {
  id: string
  label: string
  email: string
  provider: string
  unread: number
  spam: number
  syncedAt: string
}

// ponytail: sample accounts until the server can connect mailboxes; swap for a query then.
export const MAIL_ACCOUNTS: MailAccount[] = [
  { id: 'work', label: 'Work', email: 'hello@montara.app', provider: 'Google Workspace', unread: 2, spam: 3, syncedAt: '2026-10-22T14:30:00' },
  { id: 'support', label: 'Support', email: 'support@montara.app', provider: 'Microsoft 365', unread: 14, spam: 9, syncedAt: '2026-10-22T14:12:00' },
  { id: 'personal', label: 'Personal', email: 'me@fastmail.com', provider: 'IMAP', unread: 0, spam: 1, syncedAt: '2026-10-21T22:05:00' },
]

// ponytail: sample mails until the server exposes a mailbox endpoint; swap for a query then.
export const MAILS: Mail[] = [
  {
    id: 'm1',
    name: 'Friendly Vanuel',
    email: 'vanuell010@gmail.com',
    subject: 'Feedback on your landing page design',
    teaser: 'Hi, thanks for sharing the latest version. We think the hero reads much better now.',
    body: "Hi there,\n\nThanks for sharing the latest version. We think the hero reads much better now, and the new pricing table is a lot easier to scan.\n\nA few small notes are in the attached brief. Let us know when the next round is ready.\n\nBest Regards,\nVanuell",
    cc: [{ name: 'Marry', email: 'marry@vanuel.studio' }, { name: 'Josh', email: 'josh@vanuel.studio' }],
    importance: 'very important',
    receivedAt: '2026-10-22T10:06:00',
    read: false,
    tab: 'focused',
    attachments: [{ name: 'Brief Modern Dashboard.docx', size: '12 MB' }],
  },
  {
    id: 'm2',
    name: 'Dribbble',
    email: 'no-reply@dribbble.com',
    subject: 'Your shot is getting noticed',
    teaser: 'Congrats! Your recent design shot has started gaining traction with the community.',
    body: 'Congrats!\n\nYour recent design shot has started gaining traction with the community. It picked up 120 likes in the last 24 hours.\n\nKeep it up,\nThe Dribbble Team',
    importance: 'low priority',
    receivedAt: '2026-10-22T14:24:00',
    read: false,
    tab: 'others',
  },
  {
    id: 'm3',
    name: 'Figma Community',
    email: 'community@figma.com',
    verified: true,
    starred: true,
    subject: 'New resources you might like',
    teaser: 'Discover trending UI kits and design systems shared by the community this week.',
    body: "Hello,\n\nWe've found a few new resources from the Figma Community that match your recent activity and interests in UI design and design systems.\n\nDesigners around the world have been sharing incredible files this week, and we picked a few that might help you speed up your workflow or inspire your next project.\n\nBest Regards,\nFigma Community",
    importance: 'important',
    receivedAt: '2026-10-12T09:15:00',
    read: true,
    tab: 'others',
    attachments: [
      { name: 'Design-system-starter-kit.fig', size: '125 MB' },
      { name: 'UI-kit-preview.png', size: '3.6 MB' },
      { name: 'Icon-set.svg', size: '420 KB' },
    ],
  },
  {
    id: 'm4',
    name: 'Behance',
    email: 'no-reply@behance.net',
    verified: true,
    subject: 'Your project got 12 new appreciations',
    teaser: 'People around the world are loving your latest case study.',
    body: 'Hi,\n\nPeople around the world are loving your latest case study. It got 12 new appreciations this week.\n\nThe Behance Team',
    importance: 'low priority',
    receivedAt: '2026-10-08T16:40:00',
    read: true,
    tab: 'others',
  },
  {
    id: 'm5',
    name: 'Stripe',
    starred: true,
    email: 'reports@stripe.com',
    verified: true,
    subject: 'Your monthly report is ready',
    teaser: 'View your latest payments summary and analytics on the dashboard.',
    body: 'Hello,\n\nYour monthly report is ready. View your latest payments summary and analytics on the Stripe dashboard.\n\nStripe',
    importance: 'important',
    cc: [{ name: 'Finance', email: 'finance@montara.app' }],
    receivedAt: '2026-10-04T08:00:00',
    read: true,
    tab: 'focused',
  },
  {
    id: 'm6',
    name: 'Contra',
    email: 'jobs@contra.com',
    subject: 'New opportunity for UI/UX Designers',
    teaser: 'A startup is looking for a product designer to help redesign their onboarding.',
    body: 'Hi,\n\nA startup is looking for a product designer to help redesign their onboarding flow. The engagement is remote and starts next month.\n\nContra',
    importance: 'normal',
    receivedAt: '2026-08-17T11:30:00',
    read: true,
    tab: 'archive',
  },
  {
    id: 'm7',
    name: 'Notion',
    email: 'team@makenotion.com',
    verified: true,
    subject: 'Your weekly workspace digest',
    teaser: '3 pages were edited and 2 comments are waiting for your reply.',
    body: 'Hi,\n\nHere is what happened in your workspace this week: 3 pages were edited and 2 comments are waiting for your reply.\n\nThe Notion Team',
    importance: 'normal',
    receivedAt: '2026-08-12T09:00:00',
    read: false,
    tab: 'others',
  },
  {
    id: 'm8',
    name: 'Sarah Chen',
    email: 'sarah.chen@northwind.io',
    subject: 'Contract draft for the Q4 project',
    teaser: 'Attached is the first draft of the contract. Could you review section 4 before Friday?',
    body: 'Hi,\n\nAttached is the first draft of the contract for the Q4 project. Could you review section 4 (payment terms) before Friday?\n\nThanks,\nSarah',
    cc: [{ name: 'Legal', email: 'legal@northwind.io' }],
    importance: 'very important',
    receivedAt: '2026-08-09T15:20:00',
    read: false,
    starred: true,
    tab: 'focused',
    attachments: [{ name: 'Contract-Q4-draft.pdf', size: '840 KB' }],
  },
  {
    id: 'm9',
    name: 'GitHub',
    email: 'noreply@github.com',
    verified: true,
    subject: '[montara-mail-agent] Pull request merged',
    teaser: 'Your pull request "Add organization switcher" was merged into dev.',
    body: 'Your pull request "Add organization switcher" was merged into dev.\n\nView it on GitHub.',
    importance: 'low priority',
    receivedAt: '2026-08-05T18:42:00',
    read: true,
    tab: 'others',
  },
  {
    id: 'm10',
    name: 'Daniel Ortiz',
    email: 'daniel@ortiz.design',
    subject: 'Moodboard for the rebrand',
    teaser: 'I pulled together a first moodboard. Let me know which direction feels closest.',
    body: 'Hey,\n\nI pulled together a first moodboard for the rebrand. Let me know which direction feels closest and I will start on logo sketches.\n\nDaniel',
    importance: 'important',
    receivedAt: '2026-07-28T11:05:00',
    read: true,
    tab: 'focused',
    attachments: [
      { name: 'Moodboard-v1.png', size: '6.2 MB' },
      { name: 'Type-specimens.pdf', size: '1.1 MB' },
    ],
  },
  {
    id: 'm11',
    name: 'Linear',
    email: 'notifications@linear.app',
    verified: true,
    subject: '5 issues assigned to you',
    teaser: 'MON-142, MON-145 and 3 more issues were assigned to you this sprint.',
    body: 'Hi,\n\nMON-142, MON-145 and 3 more issues were assigned to you this sprint.\n\nLinear',
    importance: 'normal',
    receivedAt: '2026-07-21T08:30:00',
    read: true,
    tab: 'others',
  },
  {
    id: 'm12',
    name: 'Amelia Brooks',
    email: 'amelia@brooksventures.com',
    subject: 'Intro call next week?',
    teaser: 'Loved the demo at the meetup. Would you be open to a 30 minute call next week?',
    body: 'Hi,\n\nLoved the demo at the meetup. Would you be open to a 30 minute call next week to talk about your roadmap?\n\nBest,\nAmelia',
    importance: 'very important',
    receivedAt: '2026-07-14T16:10:00',
    read: true,
    tab: 'focused',
  },
  {
    id: 'm13',
    name: 'Vercel',
    email: 'billing@vercel.com',
    verified: true,
    subject: 'Your invoice for July',
    teaser: 'Your invoice of $20.00 for the Pro plan is now available.',
    body: 'Hello,\n\nYour invoice of $20.00 for the Pro plan is now available in the billing dashboard.\n\nVercel',
    importance: 'important',
    receivedAt: '2026-07-01T07:00:00',
    read: true,
    tab: 'archive',
    attachments: [{ name: 'Invoice-July-2026.pdf', size: '96 KB' }],
  },
  {
    id: 'm14',
    name: 'Product Hunt',
    email: 'hello@producthunt.com',
    subject: 'Top products of the week',
    teaser: 'AI note takers, a new design tool and more products the community loved.',
    body: 'Hi,\n\nThis week the community loved AI note takers, a new design tool and a calendar app for teams.\n\nProduct Hunt',
    importance: 'low priority',
    receivedAt: '2026-06-24T10:00:00',
    read: true,
    tab: 'others',
  },
  {
    id: 'm15',
    name: 'Rina Hartono',
    email: 'rina@montara.app',
    subject: 'Team offsite agenda',
    teaser: 'Here is the draft agenda for the offsite. Please add your session ideas by Monday.',
    body: 'Hi team,\n\nHere is the draft agenda for the offsite. Please add your session ideas by Monday.\n\nCheers,\nRina',
    importance: 'normal',
    receivedAt: '2026-06-17T13:45:00',
    read: true,
    tab: 'archive',
  },
]

export function mailInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

/** Short date for the list: the time for today's mail, else the day. */
export function formatMailListDate(iso: string) {
  const date = new Date(iso)
  return isToday(date) ? format(date, 'HH.mm') : format(date, 'MMM d')
}
