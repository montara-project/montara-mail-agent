import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { MailOpen, Sparkles } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import React from 'react'

import MailList, {
  DEFAULT_PAGE_SIZE,
  pageSize,
  useMailPage,
} from '@/components/block/mail/mail-list'
import MailReader from '@/components/block/mail/mail-reader'
import {
  MAIL_LABELS,
  useAgentPanelPosition,
  useMailAccount,
  useMailAccounts,
  useSplitInbox,
} from '@/components/layout/mail/mail-panel'
import { SEARCH_KEYS } from '@/components/layout/mail/mail-search'
import { Button } from '@/components/ui/button'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { toastProgress } from '@/lib/api/axios-error'
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
const AGENT_PANE = 'hidden w-80 shrink-0 lg:flex xl:w-96'
// Floating mode (Control Center > Agent tools > AI Assistant Panel) pins the
// same panel over the page's bottom right corner instead of the third pane:
// 12px inside the mail box on the right and bottom (the box sits 16px from the
// viewport), and at most as tall as leaves 12px under the box's top.
const AGENT_FLOAT =
  'fixed right-7 bottom-7 z-50 hidden h-[min(38rem,calc(100svh-7rem))] w-96 max-w-[calc(100vw-3.5rem)] overflow-hidden rounded-xl border bg-card shadow-lg lg:block'
// The send-draft shortcut as this platform writes it, for the empty pane's hint.
const SEND_KEYS =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘↵' : 'Ctrl+↵'

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
  const position = useAgentPanelPosition()
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

  const navigate = useNavigate()
  const floatingButton = React.useRef<HTMLButtonElement>(null)
  const closeAgent = async () => {
    await navigate({
      to: '/mail',
      search: (s) => ({ ...s, agent: undefined }),
    })
    floatingButton.current?.focus()
  }
  const floating = position === 'floating'
  const reduceMotion = useReducedMotion()
  const floatTransition = {
    duration: reduceMotion ? 0 : 0.25,
    ease: [0.2, 0, 0, 1] as const,
  }

  // Keyboard navigation: J and K step through the page's mail, E archives the open one.
  const { data: page } = useMailPage()
  const mails = page?.data ?? []
  const bulk = useMutation(queries.mails.bulk())
  // The mail a J/K step opened: its reader takes the focus once it loads.
  const [focusMailId, setFocusMailId] = React.useState<string>()
  const moveArchive = React.useEffectEvent(async (id: string) => {
    // The neighbour to open once the mail leaves the folder, as the reader's own Archive does.
    const index = mails.findIndex((item) => item.id === id)
    const neighbour = index === -1 ? undefined : (mails[index + 1] ?? mails[index - 1])
    const progress = toastProgress('Archiving 1 mail...')
    try {
      const res = await bulk.mutateAsync({ action: 'move', folder: 'archive', ids: [id] })
      progress.success(res.message ?? 'Done')
      // Only while it is still the open mail: the user may have moved on meanwhile.
      await navigate({
        to: '/mail',
        search: (prev) => (prev.mail === id ? { ...prev, mail: neighbour?.id } : prev),
      })
    } catch (error) {
      progress.error(error)
    }
  })
  const onKey = React.useEffectEvent(async (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return
    const key = event.key.toLowerCase()
    if (key !== 'j' && key !== 'k' && key !== 'e') return
    const target = event.target as HTMLElement | null
    // Never hijack typing in a field, or a shortcut inside an open dialog or sheet.
    if (target && (target.closest('input, textarea, select') || target.isContentEditable)) return
    if (
      document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-slot="sheet-content"][data-state="open"]'
      )
    )
      return
    if (key === 'e') {
      if (mailId && !bulk.isPending) {
        event.preventDefault()
        void moveArchive(mailId)
      }
      return
    }
    if (!mails.length) return
    const index = mails.findIndex((item) => item.id === mailId)
    // j with nothing open opens the first mail; at either end of the page j and
    // k run out of mail and do nothing, as does k with nothing open.
    const next =
      key === 'j'
        ? index === -1
          ? mails[0]
          : mails[index + 1]
        : index === -1 || index === 0
          ? undefined
          : mails[index - 1]
    if (next) {
      event.preventDefault()
      // Move focus with the selection: screen readers announce the new subject
      // heading, and sighted keyboard users see the reader is the focus target.
      setFocusMailId(next.id)
      await navigate({ to: '/mail', search: (prev) => ({ ...prev, mail: next.id }) })
    }
  })
  React.useEffect(() => {
    // A wrapped listener: an effect event can't be the listener itself.
    const handler = (event: KeyboardEvent) => onKey(event)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // One panel, mounted where its preference puts it: the third pane beside the
  // reader, or floating over the page's bottom right corner. The empty pane
  // holds its width while the code loads, so the reader doesn't jump.
  const panel = agent ? (
    <React.Suspense fallback={<div className={floating ? 'h-full w-full' : AGENT_PANE} />}>
      {/* Another mailbox starts another conversation. */}
      <AgentPanel
        key={agentAccountId}
        emailAccountId={agentAccountId}
        organizationId={organization?.id}
        onClose={floating ? closeAgent : undefined}
        className={floating ? 'h-full w-full' : AGENT_PANE}
      />
    </React.Suspense>
  ) : null

  return (
    <>
      {/* Viewport height minus the page header (3.5rem) and the page padding (2rem), so each column scrolls on its own. */}
      <div className="bg-border flex h-[calc(100svh-5.5rem)] gap-px overflow-hidden rounded-xl border bg-clip-padding">
        {/* On phones the list and the reader take turns. */}
        <MailList
          className={cn('w-full md:w-80 lg:w-96 bg-background', mailId && 'hidden md:flex')}
        />
        {mailId ? (
          <MailReader key={mailId} mailId={mailId} focusSubject={focusMailId === mailId} />
        ) : (
          <div className="bg-background text-foreground relative hidden flex-1 md:block">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-6 text-center">
              <span
                className="grid size-13 place-items-center rounded-lg border bg-muted"
                aria-hidden
              >
                <MailOpen className="size-5.5 text-ink-3" />
              </span>
              <p className="text-sm font-semibold">Select a message</p>
              <p className="text-ink-3 text-[11.5px]">
                Pick a message to read it here, or start with {SEARCH_KEYS} to search.
              </p>
            </div>
            <div className="absolute bottom-6 start-6 flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <kbd className="grid h-5 w-11 place-items-center rounded-chip bg-muted font-mono text-[10.5px] font-semibold text-muted-foreground">
                  J / K
                </kbd>
                <span className="text-ink-3 text-[10.5px]">Next or previous message</span>
              </div>
              <div className="flex items-center gap-2.5">
                <kbd className="grid h-5 w-11 place-items-center rounded-chip bg-muted font-mono text-[10.5px] font-semibold text-muted-foreground">
                  E
                </kbd>
                <span className="text-ink-3 text-[10.5px]">Archive</span>
              </div>
              <div className="flex items-center gap-2.5">
                <kbd className="grid h-5 w-11 place-items-center rounded-chip bg-muted font-mono text-[10.5px] font-semibold text-muted-foreground">
                  {SEND_KEYS}
                </kbd>
                <span className="text-ink-3 text-[10.5px]">Send draft</span>
              </div>
            </div>
          </div>
        )}
        {!floating && panel}
      </div>
      {floating && (
        <>
          {/* Stays mounted under the panel, so closing can return the focus to it. */}
          <motion.div
            className="fixed right-7 bottom-7 z-40 hidden lg:block"
            initial={false}
            animate={agent ? { opacity: 0, scale: 0.6 } : { opacity: 1, scale: 1 }}
            transition={floatTransition}
            inert={agent}
          >
            <Button
              ref={floatingButton}
              className="size-14 rounded-full shadow-lg"
              aria-label="Open AI assistant"
              title="AI assistant"
              onClick={() =>
                navigate({
                  to: '/mail',
                  search: (s) => ({ ...s, agent: true }),
                })
              }
            >
              <Sparkles className="size-5" />
            </Button>
          </motion.div>
          <AnimatePresence initial={false}>
            {panel && (
              <motion.div
                key="agent"
                className={AGENT_FLOAT}
                style={{ transformOrigin: 'bottom right' }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={floatTransition}
              >
                {panel}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  )
}
