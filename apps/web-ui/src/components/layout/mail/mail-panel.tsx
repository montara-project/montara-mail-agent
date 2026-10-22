import { Link, useSearch } from '@tanstack/react-router'
import { ArchiveX, BadgeCheck, File, Filter, Inbox, Search, Send, Trash2 } from 'lucide-react'
import React from 'react'

import OrganizationSwitcher from '@/components/layout/organization/organization-switcher'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sidebar, SidebarContent, SidebarHeader, SidebarInput } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { formatMailListDate, mailInitials, MAILS, type MailTab } from './mail-data'

export const MAIL_FOLDERS = [
  { id: 'inbox', title: 'Inbox', icon: Inbox },
  { id: 'drafts', title: 'Drafts', icon: File },
  { id: 'sent', title: 'Sent', icon: Send },
  { id: 'junk', title: 'Junk', icon: ArchiveX },
  { id: 'trash', title: 'Trash', icon: Trash2 },
]

const TABS: { id: MailTab | 'all'; title: string }[] = [
  { id: 'all', title: 'All' },
  { id: 'focused', title: 'Focused' },
  { id: 'archive', title: 'Archive' },
  { id: 'others', title: 'Others' },
]

/** The folder named by ?folder=, falling back to the inbox. */
export function useMailFolder() {
  const { folder } = useSearch({ strict: false })
  return MAIL_FOLDERS.find((item) => item.id === folder) ?? MAIL_FOLDERS[0]
}

/** Second panel of the sidebar-09 shell: the mail list of the active folder. */
export default function MailPanel() {
  const folder = useMailFolder()
  const { mail: selectedId } = useSearch({ strict: false })

  const [tab, setTab] = React.useState<MailTab | 'all'>('all')
  const [searching, setSearching] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [unreadOnly, setUnreadOnly] = React.useState(false)

  const term = search.trim().toLowerCase()
  const mails = MAILS.filter(
    (mail) =>
      (tab === 'all' || mail.tab === tab) &&
      (!unreadOnly || !mail.read) &&
      [mail.name, mail.subject, mail.teaser].some((text) => text.toLowerCase().includes(term))
  )
  const unreadCount = MAILS.filter((mail) => !mail.read).length

  return (
    <Sidebar collapsible="none" className="hidden flex-1 md:flex">
      <SidebarHeader className="gap-3.5 p-4 pb-0">
        <OrganizationSwitcher />
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <folder.icon className="size-5" />
            <span className="text-foreground text-xl font-semibold">{folder.title}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className={cn('size-8', searching && 'bg-accent')}
              aria-label="Search mail"
              aria-pressed={searching}
              onClick={() => {
                setSearching((open) => !open)
                setSearch('')
              }}
            >
              <Search />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn('size-8', unreadOnly && 'bg-accent')}
              aria-label="Show unread only"
              aria-pressed={unreadOnly}
              onClick={() => setUnreadOnly((on) => !on)}
            >
              <Filter />
            </Button>
          </div>
        </div>
        {searching && (
          <SidebarInput
            autoFocus
            placeholder="Search mail..."
            aria-label="Search mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
        <div className="-mx-4 flex border-b px-2" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'text-muted-foreground hover:text-foreground -mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent py-2.5 text-sm',
                tab === item.id && 'border-foreground text-foreground font-medium'
              )}
            >
              {item.title}
              {item.id === 'all' && unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] leading-4">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {mails.map((mail) => (
          <Link
            key={mail.id}
            to="/mail"
            search={(prev) => ({ ...prev, mail: mail.id })}
            className={cn(
              'hover:bg-sidebar-accent flex gap-3 border-b p-4 text-sm',
              selectedId === mail.id && 'bg-sidebar-accent'
            )}
          >
            <Avatar className="size-10">
              <AvatarFallback>{mailInitials(mail.name)}</AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('truncate', mail.read ? 'font-medium' : 'font-semibold')}>
                  {mail.name}
                </span>
                {mail.verified && (
                  <BadgeCheck
                    className="size-4 shrink-0 fill-blue-500 text-white"
                    aria-label="Verified"
                  />
                )}
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">
                  {formatMailListDate(mail.receivedAt)}
                </span>
              </div>
              <span className="truncate text-xs">{mail.subject}</span>
              <span className="text-muted-foreground truncate text-xs">{mail.teaser}</span>
            </div>
          </Link>
        ))}
        {mails.length === 0 && (
          <p className="text-muted-foreground p-4 text-center text-sm">No mail here.</p>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
