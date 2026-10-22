import { Bot, FolderOpen, MessageSquare, SlidersHorizontal, SquarePen, Workflow } from 'lucide-react'
import React from 'react'

import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

// ponytail: none of these have pages yet; give each a url once its route exists.
const PLATFORM_ITEMS = [
  { title: 'New Chat', icon: SquarePen },
  { title: 'Agent', icon: Bot },
  { title: 'Browse files', icon: FolderOpen },
  { title: 'Automation', icon: Workflow },
  { title: 'Control centers', icon: SlidersHorizontal },
]

// ponytail: sample history until the server stores chats; swap for a query then.
const CHAT_HISTORY = [
  { id: '1', title: 'Summarize unread mails from today', date: 'Today' },
  { id: '2', title: 'Draft a reply to Alice about the project update', date: 'Today' },
  { id: '3', title: 'Find invoices sent last month', date: 'Yesterday' },
  { id: '4', title: 'Auto-label newsletters as Junk', date: '2 days ago' },
  { id: '5', title: 'Schedule follow-up with Emily on budget', date: '1 week ago' },
]

/** Second panel of the sidebar-09 shell on the Platform pages. */
export default function PlatformPanel() {
  const [search, setSearch] = React.useState('')
  const chats = CHAT_HISTORY.filter((chat) =>
    chat.title.toLowerCase().includes(search.trim().toLowerCase())
  )

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-2">
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {PLATFORM_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent className="flex min-h-0 flex-1 flex-col gap-2">
            <SidebarInput
              placeholder="Search chats..."
              aria-label="Search chats"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton className="h-auto py-2">
                    <MessageSquare className="self-start" />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate">{chat.title}</span>
                      <span className="text-muted-foreground text-xs">{chat.date}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {chats.length === 0 && (
                <p className="text-muted-foreground px-2 py-1.5 text-xs">No chats found.</p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
