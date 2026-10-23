import { useMutation, useQuery } from '@tanstack/react-query'
import { ChevronDown, Forward, Reply as ReplyIcon, RotateCcw, Sparkles } from 'lucide-react'
import { motion, MotionConfig } from 'motion/react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import type { Reply } from './mail-editor'

import { mailInitials } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { axiosErrorMessage, toastProgress } from '@/lib/api/axios-error'
import { allEmails, MAX_RECIPIENTS } from '@/lib/api/dtos/mail/recipients'
import { queries } from '@/lib/api/queries'

import RecipientInput from './recipient-input'

const MailEditor = React.lazy(() => import('./mail-editor'))

/** "Use AI": up to three suggested replies, asked for when the menu opens since each is a model call. */
function AiMenu({ mailId, onPick }: { mailId: string; onPick: (text: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const { data, isFetching, isError, error, refetch } = useQuery({
    ...queries.mails.replySuggestions(mailId),
    enabled: open,
  })

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-violet-500/40 text-violet-700 hover:text-violet-700 dark:text-violet-300 dark:hover:text-violet-300"
        >
          <Sparkles />
          Use AI
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-80">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Suggested replies
        </DropdownMenuLabel>
        {isFetching ? (
          <div className="grid gap-2 p-2" aria-busy="true">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : isError ? (
          <>
            <p className="text-destructive px-2 py-1.5 text-sm">{axiosErrorMessage(error)}</p>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                refetch()
              }}
            >
              <RotateCcw />
              Try again
            </DropdownMenuItem>
          </>
        ) : (
          data?.map((text) => (
            <DropdownMenuItem
              key={text}
              className="whitespace-normal"
              onSelect={() => onPick(text)}
            >
              {text}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Reply to a mail: Reply and Forward buttons, then for a reply a card with
 * the recipients as chips (the sender to start with), the rich-text editor,
 * the AI menu and Send. Cancel drops the reply.
 */
export default function ReplyComposer({
  mail,
  onForward,
}: {
  mail: Models.Mail
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

  const names = mail.from_name ? { [mail.from_email]: mail.from_name } : undefined

  const close = () => {
    setOpen(false)
    setTo(sender)
    setCc([])
    setShowCc(false)
    setInitial({})
    setProblem(null)
    setAttachments([])
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

  // The card opens below the mail; bring it into view.
  React.useEffect(() => {
    if (open) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [open])

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
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="bg-card mt-6 rounded-xl border p-4 shadow-sm"
      >
        <React.Suspense
          fallback={
            <div className="grid gap-3" aria-busy="true">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          }
        >
          <MailEditor
            initial={initial}
            placeholder="Write your reply..."
            onSend={send}
            onCancel={close}
            sending={reply.isPending}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            leading={<AiMenu mailId={mail.id} onPick={(text) => setInitial({ text })} />}
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
      </motion.div>
    </MotionConfig>
  )
}
