import { createFileRoute } from '@tanstack/react-router'

import AgentPanel from '@/components/block/mail/agent-panel'
import MailList from '@/components/block/mail/mail-list'
import MailReader from '@/components/block/mail/mail-reader'
import { MAIL_LABELS, useMailAccount } from '@/components/layout/mail/mail-panel'
import { cn } from '@/lib/utils'

type MailSearch = {
  account?: string
  folder?: string
  label?: (typeof MAIL_LABELS)[number]['id']
  mail?: string
  /** 1-based page of the list. */
  page?: number
  /** Search term over sender and subject. */
  q?: string
  /** The AI assistant pane is open. */
  agent?: boolean
}

const str = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)

/** Folders live in the sidebar panel (see AppSidebar); this is the list and the reading pane. */
export const Route = createFileRoute('/(app)/mail/')({
  validateSearch: (search): MailSearch => ({
    account: str(search.account),
    folder: str(search.folder),
    label: MAIL_LABELS.find((item) => item.id === search.label)?.id,
    mail: str(search.mail),
    page:
      Number.isInteger(search.page) && Number(search.page) > 1 ? Number(search.page) : undefined,
    q: str(search.q),
    // The router parses search values as JSON, so the pane's flag arrives as
    // a boolean, a number or a string depending on who built the link. False
    // drops out of the URL entirely, so folder and label links stay clean.
    agent:
      search.agent === true || search.agent === 1 || search.agent === '1' || search.agent === 'true'
        ? true
        : undefined,
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { mail: mailId, agent } = Route.useSearch()
  const account = useMailAccount()

  return (
    // Viewport height minus the 4rem page header and 2rem of padding, so each column scrolls on its own.
    <div className="bg-card flex h-[calc(100svh-6rem)] overflow-hidden rounded-xl border">
      {/* On phones the list and the reader take turns. */}
      <MailList className={cn('w-full md:w-80 md:border-r lg:w-96', mailId && 'hidden md:flex')} />
      {mailId ? (
        <MailReader key={mailId} mailId={mailId} />
      ) : (
        <div className="text-muted-foreground hidden flex-1 items-center justify-center text-sm md:flex">
          Select an email to read it.
        </div>
      )}
      {agent && (
        <AgentPanel
          emailAccountId={account?.id}
          className="hidden w-80 shrink-0 border-l lg:flex xl:w-96"
        />
      )}
    </div>
  )
}
