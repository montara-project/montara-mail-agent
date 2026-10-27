import { useMutation, useQuery } from '@tanstack/react-query'
import { Forward, Reply as ReplyIcon, Sparkles } from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import { mailInitials } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toastProgress } from '@/lib/api/axios-error'
import { allEmails, MAX_RECIPIENTS } from '@/lib/api/dtos/mail/recipients'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

import type { Reply } from './mail-editor'

import RecipientInput from './recipient-input'
import ReplyAiPanel from './reply-writer'

const MailEditor = React.lazy(() => import('./mail-editor'))

/** Runs once it mounts; inside the editor's Suspense, that is when the lazy editor has appeared. */
function OnMount({ run }: { run: () => void }) {
  React.useEffect(run, [run])
  return null
}

/**
 * Reply to a mail: Reply and Forward buttons, then for a reply a card with
 * the recipients as chips (the sender to start with), the rich-text editor,
 * and a bottom bar whose "Use AI" opens the Write with AI panel just above it.
 * The panel is the reply's only AI surface, so it never reads as a second
 * message field and its "Write" never competes with Send. Cancel drops the reply.
 */
export default function ReplyComposer({
  mail,
  draft,
  onForward,
}: {
  mail: Models.Mail
  /** A reply a skill wrote: a new one opens the reply with it in the editor. */
  draft?: { text: string; at: number }
  /** Opens the forward dialog, offered beside Reply. */
  onForward: () => void
}) {
  const sender = React.useMemo(() => (mail.from_email ? [mail.from_email] : []), [mail.from_email])
  const [open, setOpen] = React.useState(false)
  const [to, setTo] = React.useState(sender)
  const [cc, setCc] = React.useState<string[]>([])
  const [showCc, setShowCc] = React.useState(false)
  // A new object reloads the editor, which is how a picked suggestion lands in it.
  const [initial, setInitial] = React.useState<{ text?: string }>({})
  const [problem, setProblem] = React.useState<string | null>(null)
  const [attachments, setAttachments] = React.useState<File[]>([])
  const reply = useMutation(queries.mails.reply(mail.id))
  const { data: me } = useQuery(queries.auth.profile())
  const cardRef = React.useRef<HTMLDivElement>(null)
  // Write with AI: closed until asked for, so the reply opens as a plain email.
  const [aiOpen, setAiOpen] = React.useState(false)
  // Opening the reply, and the AI panel opening above the bottom bar and growing
  // with its results, push the bar (Send, the prompt) below the fold; bring the
  // card's bottom back into view once the new layout has painted.
  const showCardBottom = React.useCallback(() => {
    requestAnimationFrame(() =>
      cardRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'end',
      })
    )
  }, [])

  const [seenDraft, setSeenDraft] = React.useState(draft)
  if (draft !== seenDraft) {
    setSeenDraft(draft)
    if (draft) {
      setOpen(true)
      setInitial({ text: draft.text })
    }
  }

  const names = mail.from_name ? { [mail.from_email]: mail.from_name } : undefined

  const close = () => {
    setOpen(false)
    setTo(sender)
    setCc([])
    setShowCc(false)
    setInitial({})
    setProblem(null)
    setAttachments([])
    setAiOpen(false)
  }

  const send = (body: Reply) => {
    const found =
      to.length === 0
        ? 'Add at least one recipient.'
        : !allEmails([...to, ...cc])
          ? 'One of the addresses is not a valid email.'
          : to.length + cc.length > MAX_RECIPIENTS
            ? `A mail goes to at most ${MAX_RECIPIENTS} addresses.`
            : null
    setProblem(found)
    if (found) return

    const progress = toastProgress('Sending reply...')
    reply.mutate(
      { to, cc: cc.length > 0 ? cc : undefined, ...body, attachments },
      {
        onSuccess: () => {
          progress.success('Reply sent')
          close()
        },
        // The card stays open with the text, so nothing typed is lost.
        onError: progress.error,
      }
    )
  }

  // The card opens below the mail: show it down to its bottom bar. The editor
  // loads lazily and is taller than its skeleton, so OnMount repeats this once
  // it has appeared.
  React.useEffect(() => {
    if (open) showCardBottom()
  }, [open, showCardBottom])

  if (!open) {
    return (
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <ReplyIcon />
          Reply
        </Button>
        <Button variant="outline" onClick={onForward}>
          <Forward />
          Forward
        </Button>
      </div>
    )
  }

  const user = me?.user
  return (
    <div
      ref={cardRef}
      className="bg-card animate-in fade-in slide-in-from-bottom-2 mt-6 rounded-xl border p-4 shadow-sm duration-200 ease-out motion-reduce:animate-none"
    >
      <React.Suspense
        fallback={
          <div className="grid gap-3" aria-busy="true">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        }
      >
        <OnMount run={showCardBottom} />
        <MailEditor
          initial={initial}
          placeholder="Write your reply..."
          onSend={send}
          onCancel={close}
          sending={reply.isPending}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          leading={
            <Button
              type="button"
              variant="outline"
              aria-expanded={aiOpen}
              aria-controls="reply-ai-panel"
              // The panel scrolls itself into view as it mounts (onGrow).
              onClick={() => setAiOpen(!aiOpen)}
              className={cn(
                'border-violet-500/40 text-violet-700 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-300',
                aiOpen && 'bg-violet-500/10 hover:bg-violet-500/15'
              )}
            >
              <Sparkles />
              Use AI
            </Button>
          }
          aside={
            aiOpen && (
              <div id="reply-ai-panel">
                <ReplyAiPanel
                  mailId={mail.id}
                  onInsert={(text) => setInitial({ text })}
                  onClose={() => setAiOpen(false)}
                  onGrow={showCardBottom}
                />
              </div>
            )
          }
          header={
            <div className="grid gap-2">
              <div className="flex items-start gap-3">
                <Avatar className="mt-0.5 size-9">
                  {user?.image && <AvatarImage src={user.image} alt="" />}
                  <AvatarFallback>{mailInitials(user?.name ?? 'Me')}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 gap-2">
                  <RecipientInput
                    label="To"
                    value={to}
                    onChange={setTo}
                    names={names}
                    placeholder="Add a recipient"
                  />
                  {showCc && (
                    <RecipientInput
                      label="Cc"
                      value={cc}
                      onChange={setCc}
                      placeholder="Add a recipient"
                    />
                  )}
                </div>
                {!showCc && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowCc(true)}>
                    Cc
                  </Button>
                )}
              </div>
              {problem && (
                <p role="alert" className="text-destructive text-sm">
                  {problem}
                </p>
              )}
            </div>
          }
        />
      </React.Suspense>
    </div>
  )
}
