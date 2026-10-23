import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import React from 'react'

import type { Draft, Reply } from './reply-editor'

import { Skeleton } from '@/components/ui/skeleton'
import { axiosErrorMessage, toastProgress } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const ReplyEditor = React.lazy(() => import('./reply-editor'))

// Magic UI rainbow-button animation, on the border only.
const RAINBOW_BORDER =
  'animate-rainbow rounded-xl border-2 border-transparent bg-[linear-gradient(var(--color-card),var(--color-card)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] bg-[length:200%] [background-clip:padding-box,border-box] [background-origin:border-box] motion-reduce:animate-none'

const CHIP =
  'bg-muted/60 hover:bg-accent text-muted-foreground hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors'

/** AI reply suggestions, asked for on demand since each one is a model call. */
function Suggestions({ mailId, onPick }: { mailId: string; onPick: (text: string) => void }) {
  const [wanted, setWanted] = React.useState(false)
  const { data, isFetching, isError, error } = useQuery({
    ...queries.mails.replySuggestions(mailId),
    enabled: wanted,
  })

  if (!data || isError) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          className={cn(CHIP, 'flex items-center gap-1.5')}
          disabled={isFetching}
          onClick={() => setWanted(true)}
        >
          <Sparkles className="size-3.5" />
          {isFetching ? 'Thinking of replies...' : 'Suggest replies'}
        </button>
        {isError && <span className="text-destructive">{axiosErrorMessage(error)}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label="Suggested replies">
      {data.map((text) => (
        <button key={text} type="button" onClick={() => onPick(text)} className={CHIP}>
          {text}
        </button>
      ))}
    </div>
  )
}

/**
 * Reply box under a mail: one line plus suggestions while minimized, a LexKit
 * rich-text editor once opened.
 */
export default function ReplyComposer({ mailId }: { mailId: string }) {
  const [open, setOpen] = React.useState(false)
  // Kept across minimize so an unsent reply is not lost.
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [initial, setInitial] = React.useState<{ state?: string; text?: string }>({})

  const openWith = (text: string) => {
    setInitial(draft ? { state: draft.state } : { text })
    setOpen(true)
  }

  const reply = useMutation(queries.mails.reply(mailId))
  // On success the reply and its draft are done; on failure the editor stays
  // open with the text, so nothing typed is lost.
  const send = (body: Reply) => {
    const progress = toastProgress('Sending reply...')
    reply.mutate(body, {
      onSuccess: () => {
        progress.success('Reply sent')
        setDraft(null)
        setOpen(false)
      },
      onError: progress.error,
    })
  }

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.25, ease: 'easeOut' }}>
      <div className="m-4">
        <AnimatePresence initial={false} mode="wait">
          {open ? (
            <motion.div
              key="open"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn(RAINBOW_BORDER, 'overflow-hidden')}
            >
              <div className="p-2">
                <React.Suspense
                  fallback={
                    <div className="grid gap-2" aria-busy="true">
                      <Skeleton className="h-7 w-40" />
                      <Skeleton className="h-28 w-full" />
                    </div>
                  }
                >
                  <ReplyEditor
                    initial={initial}
                    onMinimize={(next) => {
                      setDraft(next)
                      setOpen(false)
                    }}
                    onSend={send}
                    sending={reply.isPending}
                  />
                </React.Suspense>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="closed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="grid gap-2"
            >
              {!draft && <Suggestions mailId={mailId} onPick={openWith} />}
              <button
                type="button"
                onClick={() => openWith('')}
                className={cn(
                  RAINBOW_BORDER,
                  'text-muted-foreground flex h-11 w-full items-center px-3 text-left text-sm'
                )}
              >
                <span className={cn('truncate', draft && 'text-foreground')}>
                  {draft?.preview || 'Reply to email...'}
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
