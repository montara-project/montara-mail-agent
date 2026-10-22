import { createFileRoute } from '@tanstack/react-router'

import MailList from '@/components/block/mail/mail-list'
import MailReader from '@/components/block/mail/mail-reader'
import { MAILS, type MailTab } from '@/components/layout/mail/mail-data'
import { MAIL_LABELS } from '@/components/layout/mail/mail-panel'
import { cn } from '@/lib/utils'

type MailSearch = {
  account?: string
  folder?: string
  label?: MailTab
  mail?: string
}

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

/** Folders live in the sidebar panel (see AppSidebar); this is the list and the reading pane. */
export const Route = createFileRoute('/(app)/mail/')({
  validateSearch: (search): MailSearch => ({
    account: str(search.account),
    folder: str(search.folder),
    label: MAIL_LABELS.find((item) => item.id === search.label)?.id,
    mail: str(search.mail),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { mail: mailId } = Route.useSearch()
  const mail = MAILS.find((item) => item.id === mailId)

  return (
    // Viewport height minus the 4rem page header and 2rem of padding, so each column scrolls on its own.
    <div className="bg-card flex h-[calc(100svh-6rem)] overflow-hidden rounded-xl border">
      {/* On phones the list and the reader take turns. */}
      <MailList className={cn('w-full md:w-80 md:border-r lg:w-96', mail && 'hidden md:flex')} />
      {mail ? (
        <MailReader key={mail.id} mail={mail} />
      ) : (
        <div className="text-muted-foreground hidden flex-1 items-center justify-center text-sm md:flex">
          Select an email to read it.
        </div>
      )}
    </div>
  )
}
