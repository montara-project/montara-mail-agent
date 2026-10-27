import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Inbox,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Square,
  Wrench,
  X,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { AgentStreamEvent } from '@/lib/api/agent/stream'
import type { Models } from '@/lib/api/models'

import AgentBotRadioGroup from '@/components/block/agent-bot/agent-bot-radio-group'
import Hint from '@/components/block/common/hint'
import Markdown from '@/components/block/common/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useActiveAgentBot } from '@/hooks/use-active-agent-bot'
import { streamAgentChat } from '@/lib/api/agent/stream'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { getQueryClient } from '@/lib/providers/react-query'
import { cn } from '@/lib/utils'

/** The kinds of proposal the agent waits for approval on, in the UI's words. */
const ACTION_LABELS: Record<Models.AgentActionKind, string> = {
  send_reply: 'Reply',
  send_email: 'New email',
  forward: 'Forward',
}

/** A settled proposal's state, in the UI's words; pending shows its buttons instead. */
const STATUS_LABELS: Record<Models.AgentActionStatus, string> = {
  pending: 'Waiting',
  approved: 'Approved',
  denied: 'Denied',
  done: 'Sent',
  failed: 'Failed',
}

const TABS = [
  ['chat', 'Chat'],
  ['drafts', 'AI Drafts'],
] as const

/** Starting points for an empty chat; a click fills the composer, it does not send. */
const STARTERS = ['Find an email', 'Summarize a thread', 'Draft a reply']
/** The same, once an email is attached. */
const EMAIL_STARTERS = ['Summarize this email', 'Draft a reply to it', 'List what it asks of me']

/** "search_mails" → "Search mails": tool names as the chat shows them. */
const toolLabel = (name?: string) =>
  name ? name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : 'Tool'

interface AgentPanelProps {
  /** The mailbox the conversation is bound to. */
  emailAccountId?: string
  /** The organization whose draft queue the automation fills. */
  organizationId?: string
  className?: string
}

/** One streamed or persisted step the chat shows between prompt and answer. */
type LiveRow = { kind: 'tool' | 'action' | 'message'; text?: string; payload?: unknown }

/**
 * The mail copilot: a chat bound to the active mailbox, with the agent's tool
 * progress shown as it works and its proposed outbound mail awaiting an
 * explicit approval. Desktop only — the mail layout's third pane.
 */
export default function AgentPanel({ emailAccountId, organizationId, className }: AgentPanelProps) {
  const [tab, setTab] = React.useState<'chat' | 'drafts'>('chat')
  const [conversationId, setConversationId] = React.useState<string>()
  const [input, setInput] = React.useState('')
  const [streaming, setStreaming] = React.useState(false)
  const [live, setLive] = React.useState<LiveRow[]>([])
  // The current turn's failure, kept until the next send (failed turns
  // persist nothing server-side to show).
  const [turnError, setTurnError] = React.useState<string>()
  const abort = React.useRef<AbortController | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  // The email attached from the reader's "Ask AI" button; it rides along with
  // every question until it is removed.
  const { about } = useSearch({ strict: false })
  const navigate = useNavigate()
  const aboutMail = useQuery(queries.mails.get(about)).data
  const detach = () => navigate({ to: '/mail', search: (s) => ({ ...s, about: undefined }) })
  // The id the running turn writes into: state would be stale in the stream's
  // closures, since the conversation event may set it mid-stream.
  const conversationIdRef = React.useRef<string | undefined>(undefined)
  // The persona each turn speaks as; picked in the header, shared with the
  // reply composer's suggestions.
  const { bots, activeBot } = useActiveAgentBot()

  const detail = useQuery(queries.agent.conversation(conversationId))
  const messages = detail.data?.data.messages ?? []
  const actions = detail.data?.data.actions ?? []
  // Shares the queue's cache entry, so the count and the Drafts tab stay in step.
  const pendingDrafts = useQuery(queries.agent.drafts(organizationId, 'pending')).data?.data.length

  // Attaching an email is a prompt to ask about it: back to the chat, with
  // the composer focused once it has mounted.
  const [seenAbout, setSeenAbout] = React.useState(about)
  if (about !== seenAbout) {
    setSeenAbout(about)
    if (about) setTab('chat')
  }
  React.useEffect(() => {
    if (about) inputRef.current?.focus()
  }, [about])

  // Keep the newest message in view while the turn streams.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages.length, live.length, streaming])

  const startNewChat = () => {
    if (streaming) return
    conversationIdRef.current = undefined
    setConversationId(undefined)
    setLive([])
    setTurnError(undefined)
    setInput('')
  }

  const send = async () => {
    const message = input.trim()
    if (!message || streaming || !emailAccountId) return

    setInput('')
    setLive([])
    setTurnError(undefined)
    setStreaming(true)
    abort.current = new AbortController()

    const onEvent = (event: AgentStreamEvent) => {
      if (event.type === 'conversation') {
        const payload = event.payload as { id: string } | undefined
        if (payload?.id) {
          conversationIdRef.current = payload.id
          setConversationId(payload.id)
        }
      } else if (event.type === 'tool') {
        setLive((prev) => [...prev, { kind: 'tool', text: event.text ?? toolLabel(event.name) }])
      } else if (event.type === 'action') {
        setLive((prev) => [...prev, { kind: 'action', payload: event.payload }])
      } else if (event.type === 'message') {
        setLive((prev) => [...prev, { kind: 'message', text: event.text }])
      } else if (event.type === 'error') {
        // A failed turn persists nothing server-side, so the error lives
        // here until the next send — not in the transient stream rows.
        setTurnError(event.text ?? 'The turn failed')
        toast.error(event.text ?? 'The turn failed')
      }
    }

    try {
      await streamAgentChat(
        {
          conversation_id: conversationId,
          email_account_id: emailAccountId,
          mail_id: about,
          agent_bot_id: activeBot?.id,
          message,
        },
        onEvent,
        abort.current.signal
      )
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setTurnError(axiosErrorMessage(error))
        toast.error(axiosErrorMessage(error))
      }
    } finally {
      setStreaming(false)
      abort.current = null
      // The turn's rows are in the database; refetch the conversation the
      // stream wrote into, then drop the transient copies.
      if (conversationIdRef.current) {
        await getQueryClient().invalidateQueries({ queryKey: ['agent'] })
      }
      setLive([])
    }
  }

  const stop = () => abort.current?.abort()

  const ask = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const empty = !conversationId && live.length === 0

  return (
    <div className={cn('flex min-w-0 flex-col', className)} data-agent-panel>
      {/* Header: the same 3.5rem as the list and reader toolbars, so the borders line up. */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Sparkles className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
        <h2 className="flex-1 text-sm font-semibold">AI Assistant</h2>
        {bots.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 max-w-40 gap-1 px-2 text-xs font-normal"
                aria-label="Choose the persona"
                disabled={streaming}
              >
                <Bot aria-hidden />
                <span className="truncate">{activeBot?.name ?? 'Built-in'}</span>
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Speak as
              </DropdownMenuLabel>
              <AgentBotRadioGroup />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Hint label="New chat">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="New chat"
            disabled={streaming || (empty && !turnError)}
            onClick={startNewChat}
          >
            <Plus />
          </Button>
        </Hint>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b px-4 py-2">
        <div role="tablist" aria-label="Assistant" className="bg-muted flex rounded-lg p-0.5">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              id={`agent-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`agent-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
                const other = id === 'chat' ? 'drafts' : 'chat'
                setTab(other)
                document.getElementById(`agent-tab-${other}`)?.focus()
              }}
              className={cn(
                'focus-visible:ring-ring/50 flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]',
                tab === id
                  ? 'bg-background dark:bg-input shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              {id === 'drafts' && !!pendingDrafts && (
                <span className="rounded-full bg-violet-500/15 px-1.5 text-[11px] text-violet-700 tabular-nums dark:text-violet-300">
                  {pendingDrafts}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'drafts' ? (
        <div
          id="agent-panel-drafts"
          role="tabpanel"
          aria-labelledby="agent-tab-drafts"
          className="flex min-h-0 flex-1 flex-col"
        >
          <DraftsQueue organizationId={organizationId} />
        </div>
      ) : (
        <div
          id="agent-panel-chat"
          role="tabpanel"
          aria-labelledby="agent-tab-chat"
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Conversation */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-busy={streaming}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {empty ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  <Sparkles className="size-5" aria-hidden />
                </div>
                <p className="text-muted-foreground max-w-64 text-sm text-balance">
                  Ask about this mailbox: find an email, summarize a thread, draft a reply, or have
                  mail moved out of the way.
                </p>
                {emailAccountId && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {(about ? EMAIL_STARTERS : STARTERS).map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full text-xs font-normal"
                        onClick={() => ask(prompt)}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <AgentMessageRow key={message.id} message={message} />
                ))}
                {actions.map((action) => (
                  <AgentActionCard key={action.id} action={action} />
                ))}
                {live.map((row, index) => (
                  <LiveRowView key={`live-${index}`} row={row} />
                ))}
                {turnError && (
                  <p
                    role="alert"
                    className="text-destructive bg-destructive/5 rounded-lg px-3 py-2 text-xs"
                  >
                    {turnError}
                  </p>
                )}
                {streaming && (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                    Working…
                  </div>
                )}
              </>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t p-3">
            {about && (
              <div className="mb-2 flex items-center gap-2 rounded-md border bg-violet-500/5 py-1 pr-1 pl-2 text-xs">
                <Mail
                  className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400"
                  aria-hidden
                />
                <span className="text-muted-foreground shrink-0">About</span>
                <span className="min-w-0 flex-1 truncate font-medium" title={aboutMail?.subject}>
                  {aboutMail ? aboutMail.subject || '(no subject)' : 'this email'}
                </span>
                <Hint label="Remove">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label="Remove the attached email"
                    onClick={detach}
                  >
                    <X className="size-3.5" />
                  </Button>
                </Hint>
              </div>
            )}
            <div className="relative">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void send()
                  }
                }}
                aria-label="Message the assistant"
                placeholder={
                  !emailAccountId
                    ? 'Select a mailbox first'
                    : about
                      ? 'Ask about this email…'
                      : 'Ask the assistant…'
                }
                disabled={!emailAccountId || streaming}
                className="field-sizing-content max-h-40 min-h-16 resize-none pr-12"
                rows={2}
              />
              {streaming ? (
                <Hint label="Stop">
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-2 bottom-2 size-7"
                    aria-label="Stop"
                    onClick={stop}
                  >
                    <Square className="size-3 fill-current" />
                  </Button>
                </Hint>
              ) : (
                <Hint label="Send">
                  <Button
                    size="icon"
                    className="absolute right-2 bottom-2 size-7"
                    aria-label="Send"
                    disabled={!input.trim() || !emailAccountId}
                    onClick={() => void send()}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                </Hint>
              )}
            </div>
            <p className="text-muted-foreground mt-1.5 px-0.5 text-[11px]">
              Enter to send, Shift+Enter for a new line. Nothing goes out until you approve it.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/** The automation's review queue: drafted replies waiting to be sent. */
function DraftsQueue({ organizationId }: { organizationId?: string }) {
  const drafts = useQuery(queries.agent.drafts(organizationId, 'pending'))
  const { bots } = useActiveAgentBot()
  const botName = (id?: string | null) => bots.find((bot) => bot.id === id)?.name
  const approve = useMutation(queries.agent.approveDraft())
  const discard = useMutation(queries.agent.discardDraft())

  // Only the draft being decided waits; the rest of the queue stays usable.
  const deciding = approve.isPending
    ? approve.variables
    : discard.isPending
      ? discard.variables
      : undefined

  const decide = async (decision: 'approve' | 'discard', id: string) => {
    const mutation = decision === 'approve' ? approve : discard
    try {
      await mutation.mutateAsync(id)
      toast.success(decision === 'approve' ? 'Draft sent' : 'Draft discarded')
    } catch (error) {
      toast.error(axiosErrorMessage(error))
    }
  }

  if (!organizationId) {
    return (
      <p className="text-muted-foreground p-4 text-center text-sm">No organization selected.</p>
    )
  }
  if (drafts.isPending) {
    return (
      <div className="grid gap-3 p-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    )
  }
  const rows = drafts.data?.data ?? []
  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Inbox className="text-muted-foreground size-6" aria-hidden />
        <p className="text-muted-foreground max-w-64 text-sm text-balance">
          No drafts waiting. The automation drafts replies for important mail here.
        </p>
      </div>
    )
  }
  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {rows.map((draft) => (
        <div key={draft.id} className="rounded-xl border p-3" aria-busy={deciding === draft.id}>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium" title={draft.subject}>
              {draft.subject}
            </p>
            {botName(draft.agent_bot_id) && (
              <Badge variant="secondary" appearance="light" className="max-w-28 shrink-0">
                <span className="truncate">{botName(draft.agent_bot_id)}</span>
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">To: {draft.to.join(', ')}</p>
          <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-line text-xs">
            {draft.text}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-7"
              disabled={deciding === draft.id}
              onClick={() => void decide('approve', draft.id)}
            >
              Approve &amp; send
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              disabled={deciding === draft.id}
              onClick={() => void decide('discard', draft.id)}
            >
              Discard
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function AgentMessageRow({ message }: { message: Models.AgentMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2 text-sm">
          {message.content}
        </div>
      </div>
    )
  }
  if (message.role === 'tool') {
    return (
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Wrench className="size-3 opacity-60" aria-hidden />
        <span>{toolLabel(message.tool_name)}</span>
      </div>
    )
  }
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-violet-500/5 px-3.5 py-2.5 text-sm dark:bg-violet-400/10">
      {message.content ? (
        <Markdown>{message.content}</Markdown>
      ) : (
        <span className="text-muted-foreground text-xs">(worked with tools)</span>
      )}
    </div>
  )
}

function LiveRowView({ row }: { row: LiveRow }) {
  if (row.kind === 'tool') {
    return (
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 className="size-3 animate-spin opacity-60 motion-reduce:animate-none" />
        <span>{row.text}</span>
      </div>
    )
  }
  if (row.kind === 'action') {
    return <AgentActionCard action={row.payload as Models.AgentAction} />
  }
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-violet-500/5 px-3.5 py-2.5 text-sm dark:bg-violet-400/10">
      <Markdown>{row.text ?? ''}</Markdown>
    </div>
  )
}

function AgentActionCard({ action }: { action: Models.AgentAction }) {
  const approve = useMutation(queries.agent.approveAction())
  const deny = useMutation(queries.agent.denyAction())

  const decide = async (decision: 'approve' | 'deny') => {
    const mutation = decision === 'approve' ? approve : deny
    try {
      await mutation.mutateAsync(action.id)
      toast.success(decision === 'approve' ? 'Mail sent' : 'Proposal discarded')
    } catch (error) {
      toast.error(axiosErrorMessage(error))
    }
  }

  const to = (action.payload.to ?? []).join(', ')
  const deciding = approve.isPending || deny.isPending

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 dark:bg-violet-400/10">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" appearance="light">
          {ACTION_LABELS[action.kind]}
        </Badge>
        <span
          className="min-w-0 flex-1 truncate text-xs font-medium"
          title={action.payload.subject}
        >
          {action.payload.subject}
        </span>
        {action.status !== 'pending' && (
          <Badge
            variant={
              action.status === 'done'
                ? 'success'
                : action.status === 'failed'
                  ? 'destructive'
                  : 'secondary'
            }
            appearance="light"
          >
            {STATUS_LABELS[action.status]}
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground mt-1 truncate text-xs">To: {to}</p>
      {action.payload.text && (
        <p className="text-muted-foreground mt-1 line-clamp-3 whitespace-pre-line text-xs">
          {action.payload.text}
        </p>
      )}
      {action.error && <p className="text-destructive mt-1 text-xs">{action.error}</p>}
      {action.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="h-7"
            disabled={deciding}
            onClick={() => void decide('approve')}
          >
            Approve &amp; send
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            disabled={deciding}
            onClick={() => void decide('deny')}
          >
            Deny
          </Button>
        </div>
      )}
    </div>
  )
}
