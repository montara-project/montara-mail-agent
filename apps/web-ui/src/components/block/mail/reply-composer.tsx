import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import React from 'react'
import { toast } from 'sonner'

import type { Draft } from './reply-editor'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const ReplyEditor = React.lazy(() => import('./reply-editor'))

// Magic UI rainbow-button animation, on the border only.
const RAINBOW_BORDER =
  'animate-rainbow rounded-xl border-2 border-transparent bg-[linear-gradient(var(--color-card),var(--color-card)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] bg-[length:200%] [background-clip:padding-box,border-box] [background-origin:border-box] motion-reduce:animate-none'

// ponytail: fixed suggestions; generate them per mail with the AI endpoint once wanted.
const SUGGESTIONS = [
  'Thanks, I will take a look.',
  'Sounds good to me!',
  'Can we schedule a quick call?',
]

/**
 * Reply box under a mail: one line plus suggestions while minimized, a LexKit
 * rich-text editor once opened.
 */
export default function ReplyComposer() {
  const [open, setOpen] = React.useState(false)
  // Kept across minimize so an unsent reply is not lost.
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [initial, setInitial] = React.useState<{ state?: string; text?: string }>({})

  const openWith = (text: string) => {
    setInitial(draft ? { state: draft.state } : { text })
    setOpen(true)
  }

  const send = () => {
    // ponytail: no send endpoint yet; wire this to the mail API once it exists.
    toast.info('Sending replies is not available yet')
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
              {!draft && (
                <div className="flex flex-wrap gap-2" aria-label="Suggested replies">
                  {SUGGESTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => openWith(text)}
                      className="bg-muted/60 hover:bg-accent text-muted-foreground hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
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
