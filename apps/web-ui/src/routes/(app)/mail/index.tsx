import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'

import MailList, { DEFAULT_PAGE_SIZE, pageSize } from '@/components/block/mail/mail-list'
import MailReader from '@/components/block/mail/mail-reader'
import {
  MAIL_LABELS,
  useMailAccount,
  useMailAccounts,
  useSplitInbox,
} from '@/components/layout/mail/mail-panel'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

type MailSearch = {
  account?: string
  folder?: string
  label?: (typeof MAIL_LABELS)[number]['id']
  mail?: string
  /** 1-based page of the list. */
  page?: number
  /** Mails per page; absent means the default (DEFAULT_PAGE_SIZE). */
  limit?: number
  /** Search term over sender and subject. */
  q?: string
  /** The AI assistant pane is open. */
  agent?: boolean
  /** The email attached to the assistant's next questions. */
  about?: string
}

// The assistant pane is closed by default and desktop only, so its code waits until it opens.
const AgentPanel = React.lazy(() => import('@/components/block/mail/agent-panel'))
const AGENT_PANE = 'hidden w-80 shrink-0 border-l lg:flex xl:w-96'

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
    // The default page size stays out of the URL.
    limit: pageSize(search.limit) === DEFAULT_PAGE_SIZE ? undefined : pageSize(search.limit),
    q: str(search.q),
    // The router parses search values as JSON, so the pane's flag arrives as
    // a boolean, a number or a string depending on who built the link. False
    // drops out of the URL entirely, so folder and label links stay clean.
    agent:
      search.agent === true || search.agent === 1 || search.agent === '1' || search.agent === 'true'
        ? true
        : undefined,
    about: str(search.about),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const { mail: mailId, agent, about } = Route.useSearch()
  const account = useMailAccount()
  const split = useSplitInbox()
  const { data: accounts } = useMailAccounts()
  const aboutMail = useQuery(queries.mails.get(about))
  const aboutAccountId = aboutMail.data?.email_account_id
  const { organization } = useActiveOrganization()
  // A conversation works on one mailbox. The global inbox has none open, so the
  // assistant takes the attached mail's, waiting for it to load. Removing the
  // attachment changes no mailbox, so it stays on the last one, else the first.
  const [lastAboutAccountId, setLastAboutAccountId] = React.useState<string>()
  if (aboutAccountId && aboutAccountId !== lastAboutAccountId) {
    setLastAboutAccountId(aboutAccountId)
  }
  const unattachedAccountId =
    accounts?.find((item) => item.id === lastAboutAccountId)?.id ?? accounts?.[0]?.id
  const globalAccountId = about && !aboutMail.isError ? aboutAccountId : unattachedAccountId
  const agentAccountId = split === false ? globalAccountId : account?.id

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
        // The empty pane holds its width while the code loads, so the reader doesn't jump.
        <React.Suspense fallback={<div className={AGENT_PANE} />}>
          {/* Another mailbox starts another conversation. */}
          <AgentPanel
            key={agentAccountId}
            emailAccountId={agentAccountId}
            organizationId={organization?.id}
            className={AGENT_PANE}
          />
        </React.Suspense>
      )}
    </div>
  )
}
