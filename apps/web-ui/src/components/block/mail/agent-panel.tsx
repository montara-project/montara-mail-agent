import { IconLoader2, IconPlus, IconSend, IconSparkles, IconSquare } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import React from 'react'
import { toast } from 'sonner'

import type { AgentStreamEvent } from '@/lib/api/agent/stream'
import type { Models } from '@/lib/api/models'

import Markdown from '@/components/block/common/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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

interface AgentPanelProps {
  /** The mailbox the conversation is bound to. */
  emailAccountId?: string
  className?: string
}

/** One streamed or persisted step the chat shows between prompt and answer. */
type LiveRow = { kind: 'tool' | 'action' | 'message' | 'error'; text?: string; payload?: unknown }

/**
 * The mail copilot: a chat bound to the active mailbox, with the agent's tool
 * progress shown as it works and its proposed outbound mail awaiting an
 * explicit approval. Desktop only — the mail layout's third pane.
 */
export default function AgentPanel({ emailAccountId, className }: AgentPanelProps) {
  const [conversationId, setConversationId] = React.useState<string>()
  const [input, setInput] = React.useState('')
  const [streaming, setStreaming] = React.useState(false)
  const [live, setLive] = React.useState<LiveRow[]>([])
  // The current turn's failure, kept until the next send (failed turns
  // persist nothing server-side to show).
  const [turnError, setTurnError] = React.useState<string>()
  const abort = React.useRef<AbortController | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  // The id the running turn writes into: state would be stale in the stream's
  // closures, since the conversation event may set it mid-stream.
  const conversationIdRef = React.useRef<string | undefined>(undefined)

  const detail = useQuery(queries.agent.conversation(conversationId))
  const messages = detail.data?.data.messages ?? []
  const actions = detail.data?.data.actions ?? []

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
        setLive((prev) => [...prev, { kind: 'tool', text: event.text ?? event.name }])
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
        { conversation_id: conversationId, email_account_id: emailAccountId, message },
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

  return (
    <div className={cn('flex min-w-0 flex-col', className)} data-agent-panel>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <IconSparkles className="text-violet-600 dark:text-violet-400" />
        <h2 className="flex-1 text-sm font-semibold">AI Assistant</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="New chat"
          onClick={startNewChat}
        >
          <IconPlus className="size-4" />
        </Button>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!conversationId && live.length === 0 ? (
          <div className="text-muted-foreground mt-16 text-center text-sm">
            <IconSparkles className="mx-auto mb-3 size-8 opacity-40" />
            <p>Ask about this mailbox: find an email, summarize a thread,</p>
            <p>draft a reply, or have mail moved out of the way.</p>
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
            {turnError && <p className="text-destructive text-xs">{turnError}</p>}
            {streaming && (
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <IconLoader2 className="size-3.5 animate-spin" />
                Working…
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder={emailAccountId ? 'Ask the assistant…' : 'Select a mailbox first'}
            disabled={!emailAccountId || streaming}
            className="max-h-40 min-h-16 pr-12"
            rows={2}
          />
          {streaming ? (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 bottom-2 size-7"
              aria-label="Stop"
              onClick={stop}
            >
              <IconSquare className="size-3.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="absolute right-2 bottom-2 size-7"
              aria-label="Send"
              disabled={!input.trim() || !emailAccountId}
              onClick={() => void send()}
            >
              <IconSend className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
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
        <IconSparkles className="size-3 opacity-60" />
        <span>{message.tool_name ?? 'tool'}</span>
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
        <IconLoader2 className="size-3 animate-spin opacity-60" />
        <span>{row.text}</span>
      </div>
    )
  }
  if (row.kind === 'action') {
    return <AgentActionCard action={row.payload as Models.AgentAction} />
  }
  if (row.kind === 'error') {
    return <p className="text-destructive text-xs">{row.text}</p>
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

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 dark:bg-violet-400/10">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" appearance="light">
          {ACTION_LABELS[action.kind]}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
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
            {action.status}
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
        <div className="mt-2 flex gap-2">
          <Button
            size="sm"
            className="h-7"
            disabled={approve.isPending}
            onClick={() => void decide('approve')}
          >
            Approve &amp; send
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            disabled={deny.isPending}
            onClick={() => void decide('deny')}
          >
            Deny
          </Button>
        </div>
      )}
    </div>
  )
}
