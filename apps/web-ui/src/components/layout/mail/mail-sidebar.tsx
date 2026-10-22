import { IconMail } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { ArchiveX, File, Inbox, Send, Trash2 } from 'lucide-react'
import React from 'react'

import type { UserInfo } from '@/types/menu'

import NavUser from '@/components/layout/sidebar/nav-user'
import { Label } from '@/components/ui/label'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Switch } from '@/components/ui/switch'

const FOLDERS = [
  { title: 'Inbox', icon: Inbox },
  { title: 'Drafts', icon: File },
  { title: 'Sent', icon: Send },
  { title: 'Junk', icon: ArchiveX },
  { title: 'Trash', icon: Trash2 },
]

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

type MailSidebarProps = React.ComponentProps<typeof Sidebar> & {
  /** The signed-in user; undefined while the profile loads. */
  user?: UserInfo
  userError?: boolean
  onRetryUser?: () => void
}

/** shadcn sidebar-09: an icon rail of folders next to the mail list. */
export default function MailSidebar({ user, userError, onRetryUser, ...props }: MailSidebarProps) {
  const [activeFolder, setActiveFolder] = React.useState(FOLDERS[0])
  const { setOpen } = useSidebar()

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      {...props}
    >
      {/* Icon rail: not collapsible, fixed to the icon width. */}
      <Sidebar collapsible="none" className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <Link to="/dashboard">
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <IconMail className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Montara</span>
                    <span className="truncate text-xs">Mail</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {FOLDERS.map((folder) => (
                  <SidebarMenuItem key={folder.title}>
                    <SidebarMenuButton
                      tooltip={{ children: folder.title, hidden: false }}
                      onClick={() => {
                        setActiveFolder(folder)
                        setOpen(true)
                      }}
                      isActive={activeFolder.title === folder.title}
                      className="px-2.5 md:px-2"
                    >
                      <folder.icon />
                      <span>{folder.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={user} userError={userError} onRetryUser={onRetryUser} />
        </SidebarFooter>
      </Sidebar>

      {/* Mail list: fills the remaining width. */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-foreground text-base font-medium">{activeFolder.title}</div>
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
    </Sidebar>
  )
}
