import { Mail, OctagonAlert, PlugZap } from 'lucide-react'

import { MAIL_ACCOUNTS } from '@/components/layout/mail/mail-data'

/** Totals across every connected account. */
export default function MailStats() {
  const stats = [
    { label: 'Unread', value: MAIL_ACCOUNTS.reduce((sum, a) => sum + a.unread, 0), icon: Mail },
    { label: 'Spam', value: MAIL_ACCOUNTS.reduce((sum, a) => sum + a.spam, 0), icon: OctagonAlert },
    { label: 'Accounts connected', value: MAIL_ACCOUNTS.length, icon: PlugZap },
  ]

  return (
    <section aria-label="Mail overview" className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-card grid gap-2 rounded-xl border p-4 text-sm">
          <div className="text-muted-foreground flex items-center justify-between">
            <span>{stat.label}</span>
            <stat.icon className="size-4" />
          </div>
          <span className="text-3xl font-semibold tabular-nums">{stat.value}</span>
        </div>
      ))}
    </section>
  )
}
