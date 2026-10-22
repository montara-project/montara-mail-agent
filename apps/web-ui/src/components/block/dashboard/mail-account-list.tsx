import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import { MAIL_ACCOUNTS, mailInitials } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

/** Connected mail accounts; each card opens that account's mailbox. */
export default function MailAccountList() {
  return (
    <section aria-labelledby="mail-accounts-title" className="grid gap-3">
      <div>
        <h2 id="mail-accounts-title" className="text-lg font-semibold">
          Email accounts
        </h2>
        <p className="text-muted-foreground text-sm">Pick an account to open its mailbox.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MAIL_ACCOUNTS.map((account) => (
          <Link
            key={account.id}
            to="/mail"
            search={{ account: account.id }}
            className="bg-card hover:bg-accent/50 focus-visible:ring-ring/50 grid gap-4 rounded-xl border p-4 text-sm transition-colors outline-none focus-visible:ring-[3px]"
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback>{mailInitials(account.label)}</AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1">
                <span className="truncate font-semibold">{account.label}</span>
                <span className="text-muted-foreground truncate text-xs">{account.email}</span>
              </div>
              {account.unread > 0 && <Badge>{account.unread} unread</Badge>}
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <span>{account.provider}</span>
              <span>Synced {formatDistanceToNow(new Date(account.syncedAt), { addSuffix: true })}</span>
            </div>
          </Link>
        ))}
        {/* ponytail: no endpoint to connect a mailbox yet; open an OAuth/IMAP flow once it exists. */}
        <button
          type="button"
          onClick={() => toast.info('Connecting an email account is not available yet')}
          className="text-muted-foreground hover:bg-accent/50 hover:text-foreground focus-visible:ring-ring/50 flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm transition-colors outline-none focus-visible:ring-[3px]"
        >
          <Plus className="size-5" />
          Add email account
        </button>
      </div>
    </section>
  )
}
