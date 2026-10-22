import { createFileRoute } from '@tanstack/react-router'

import MailReader from '@/components/block/mail/mail-reader'
import { MAILS } from '@/components/layout/mail/mail-data'

type MailSearch = {
  folder?: string
  mail?: string
}

/** The mail list lives in the sidebar (see AppSidebar); this is the reading pane. */
export const Route = createFileRoute('/(app)/mail/')({
  validateSearch: (search): MailSearch => ({
    folder: typeof search.folder === 'string' ? search.folder : undefined,
    mail: typeof search.mail === 'string' ? search.mail : undefined,
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { mail: mailId } = Route.useSearch()
  const mail = MAILS.find((item) => item.id === mailId)

  if (!mail) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Select an email to read it.
      </div>
    )
  }

  return <MailReader key={mail.id} mail={mail} />
}
