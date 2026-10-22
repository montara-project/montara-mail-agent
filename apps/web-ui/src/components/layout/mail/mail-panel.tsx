import { useSearch } from '@tanstack/react-router'
import { ArchiveX, File, Inbox, Send, Trash2 } from 'lucide-react'

import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import { Label } from '@/components/ui/label'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
} from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'

export const MAIL_FOLDERS = [
  { id: 'inbox', title: 'Inbox', icon: Inbox },
  { id: 'drafts', title: 'Drafts', icon: File },
  { id: 'sent', title: 'Sent', icon: Send },
  { id: 'junk', title: 'Junk', icon: ArchiveX },
  { id: 'trash', title: 'Trash', icon: Trash2 },
]

/** The folder named by ?folder=, falling back to the inbox. */
export function useMailFolder() {
  const { folder } = useSearch({ strict: false })
  return MAIL_FOLDERS.find((item) => item.id === folder) ?? MAIL_FOLDERS[0]
}

// ponytail: sample mails until the server exposes a mailbox endpoint; swap for a query then.
const MAILS = [
  {
    name: 'William Smith',
    email: 'williamsmith@example.com',
    subject: 'Meeting Tomorrow',
    date: '09:34 AM',
    teaser:
      'Hi team, just a reminder about our meeting tomorrow at 10 AM.\nPlease come prepared with your project updates.',
  },
  {
    name: 'Alice Smith',
    email: 'alicesmith@example.com',
    subject: 'Re: Project Update',
    date: 'Yesterday',
    teaser:
      "Thanks for the update. The progress looks great so far.\nLet's schedule a call to discuss the next steps.",
  },
  {
    name: 'Bob Johnson',
    email: 'bobjohnson@example.com',
    subject: 'Weekend Plans',
    date: '2 days ago',
    teaser:
      "Hey everyone! I'm thinking of organizing a team outing this weekend.\nWould you be interested in a hiking trip or a beach day?",
  },
  {
    name: 'Emily Davis',
    email: 'emilydavis@example.com',
    subject: 'Re: Question about Budget',
    date: '2 days ago',
    teaser:
      "I've reviewed the budget numbers you sent over.\nCan we set up a quick call to discuss some potential adjustments?",
  },
  {
    name: 'Michael Wilson',
    email: 'michaelwilson@example.com',
    subject: 'Important Announcement',
    date: '1 week ago',
    teaser:
      "Please join us for an all-hands meeting this Friday at 3 PM.\nWe have some exciting news to share about the company's future.",
  },
]

/** Second panel of the sidebar-09 shell: the mail list of the active folder. */
export default function MailPanel() {
  const folder = useMailFolder()

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 border-b p-4">
        <OrganizationSwitcher />
        <div className="flex w-full items-center justify-between pt-2">
          <div className="text-foreground text-base font-medium">{folder.title}</div>
          <Label className="flex items-center gap-2 text-sm">
            <span>Unreads</span>
            <Switch className="shadow-none" />
          </Label>
        </div>
        <SidebarInput placeholder="Type to search..." />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            {MAILS.map((mail) => (
              <a
                href="#"
                key={mail.email}
                className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex flex-col items-start gap-2 border-b p-4 text-sm leading-tight whitespace-nowrap last:border-b-0"
              >
                <div className="flex w-full items-center gap-2">
                  <span>{mail.name}</span>
                  <span className="ml-auto text-xs">{mail.date}</span>
                </div>
                <span className="font-medium">{mail.subject}</span>
                <span className="line-clamp-2 w-[260px] text-xs whitespace-break-spaces">
                  {mail.teaser}
                </span>
              </a>
            ))}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
