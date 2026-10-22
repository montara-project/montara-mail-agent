import { Link, useSearch } from '@tanstack/react-router'
import { BadgeCheck, Paperclip, Search, Star } from 'lucide-react'
import React from 'react'

import { formatMailListDate, MAILS } from '@/components/layout/mail/mail-data'
import { useMailFolder } from '@/components/layout/mail/mail-panel'
import { cn } from '@/lib/utils'

/** Middle column of the mailbox: the mail of the active folder and label. */
export default function MailList({ className }: { className?: string }) {
  const folder = useMailFolder()
  const { mail: selectedId, label } = useSearch({ strict: false })
  const [search, setSearch] = React.useState('')
  const searchRef = React.useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K jumps to the search box.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const term = search.trim().toLowerCase()
  const mails = MAILS.filter(
    (mail) =>
      (!label || mail.tab === label) &&
      [mail.name, mail.subject, mail.teaser].some((text) => text.toLowerCase().includes(term))
  )
  const unreadCount = MAILS.filter((mail) => !mail.read).length

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <h2 className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">{folder.title}</span>
          {unreadCount > 0 && <span className="text-muted-foreground text-xs">{unreadCount} Unread</span>}
        </h2>
        <label className="bg-muted/60 focus-within:ring-ring/50 ml-auto flex h-9 w-44 items-center gap-2 rounded-lg px-2.5 focus-within:ring-[3px]">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            ref={searchRef}
            placeholder="Search"
            aria-label="Search mail"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="text-muted-foreground text-xs">⌘K</kbd>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mails.map((mail) => (
          <Link
            key={mail.id}
            to="/mail"
            search={(prev) => ({ ...prev, mail: mail.id })}
            className={cn(
              'hover:bg-accent/50 grid grid-cols-[1rem_1fr] gap-x-2 border-b px-4 py-4 text-sm',
              selectedId === mail.id && 'bg-accent hover:bg-accent'
            )}
          >
            <span className="flex h-5 items-center justify-center">
              {!mail.read ? (
                <span className="bg-primary size-2 rounded-full" aria-label="Unread" />
              ) : (
                mail.starred && (
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="Starred" />
                )
              )}
            </span>
            <div className="grid min-w-0 gap-1">
              <div className="flex items-center gap-1.5">
                <span className={cn('truncate text-[15px]', mail.read ? 'font-medium' : 'font-semibold')}>
                  {mail.name}
                </span>
                {mail.verified && (
                  <BadgeCheck className="size-4 shrink-0 fill-blue-500 text-white" aria-label="Verified" />
                )}
                <span
                  className={cn(
                    'ml-auto shrink-0 text-xs',
                    mail.read ? 'text-muted-foreground' : 'text-foreground font-medium'
                  )}
                >
                  {formatMailListDate(mail.receivedAt)}
                </span>
              </div>
              <span className="truncate font-medium">{mail.subject}</span>
              <span className="text-muted-foreground line-clamp-2">{mail.teaser}</span>
              {mail.attachments && (
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  <span className="bg-muted flex min-w-0 items-center gap-1 rounded-md px-2 py-1">
                    <Paperclip className="size-3 shrink-0" />
                    <span className="truncate">{mail.attachments[0].name}</span>
                  </span>
                  {mail.attachments.length > 1 && (
                    <span className="bg-muted rounded-md px-2 py-1">+{mail.attachments.length - 1}</span>
                  )}
                </div>
              )}
            </div>
          </Link>
        ))}
        {mails.length === 0 && <p className="text-muted-foreground p-4 text-center text-sm">No mail here.</p>}
      </div>
    </div>
  )
}
