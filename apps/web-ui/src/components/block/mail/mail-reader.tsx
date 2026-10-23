import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  EllipsisVertical,
  FolderInput,
  Forward,
  Mail as MailIcon,
  OctagonAlert,
  Printer,
  RotateCcw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import React from 'react'

import type { Models } from '@/lib/api/models'

import Markdown from '@/components/block/common/markdown'
import MailBody from '@/components/block/mail/mail-body'
import { useMailPage } from '@/components/block/mail/mail-list'
import ReplyComposer from '@/components/block/mail/reply-composer'
import { IMPORTANCE_LABELS, mailInitials, senderName } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { axiosErrorMessage, toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

function IconButton({ label, ...props }: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label={label}
      title={label}
      {...props}
    />
  )
}

/** "Name email" pairs, as in the To and Cc lines. */
function Contacts({ contacts }: { contacts: Models.MailContact[] }) {
  return contacts.map((contact, i) => (
    <React.Fragment key={contact.email}>
      {i > 0 && ', '}
      {contact.name && <span className="text-foreground">{contact.name}</span>} {contact.email}
    </React.Fragment>
  ))
}

const OTHER_IMPORTANCE: Record<Models.MailImportance, Models.MailImportance> = {
  important: 'low_priority',
  low_priority: 'important',
}

/** Reading pane for one mail: toolbar, header, AI importance and summary, body and reply box. */
export default function MailReader({ mailId }: { mailId: string }) {
  const navigate = useNavigate()
  const { data: mail, isPending, isError, error } = useQuery(queries.mails.get(mailId))
  const patch = useMutation(queries.mails.patch(mailId))
  // A kept summary shows right away; otherwise the panel waits for a click.
  const [summaryToggled, setSummaryOpen] = React.useState<boolean | null>(null)
  const summaryOpen = summaryToggled ?? !!mail?.summary
  // Asked for on the first open of a mail without one; the server keeps it after that.
  const summary = useQuery({
    ...queries.mails.summary(mailId),
    enabled: summaryOpen && !!mail && !mail.summary,
  })
  const summaryText = mail?.summary ?? summary.data

  // Opening a mail reads it.
  const markRead = React.useEffectEvent(() => {
    if (mail && !mail.is_read && !patch.isPending) patch.mutate({ is_read: true })
  })
  React.useEffect(() => markRead(), [mail?.id])

  // Prev/next walk the list page the mail was opened from.
  const { data: page } = useMailPage()
  const pageMails = page?.data ?? []
  const index = pageMails.findIndex((item) => item.id === mailId)
  const prev = index > 0 ? pageMails[index - 1] : undefined
  const next = index >= 0 ? pageMails[index + 1] : undefined

  const backToList = () => navigate({ to: '/mail', search: (s) => ({ ...s, mail: undefined }) })
  const update = (body: Parameters<typeof patch.mutate>[0], then?: () => void) =>
    patch.mutate(body, { onSuccess: then, onError: toastAxiosError })

  if (isPending || isError || !mail) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-6" aria-busy={isPending}>
        {isError ? (
          <p className="text-destructive text-sm">{axiosErrorMessage(error)}</p>
        ) : (
          <>
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-40 w-full" />
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* ponytail: report, delete and move need IMAP write-back; until then they do nothing. */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-0.5">
          <IconButton label="Back to list" onClick={backToList}>
            <ArrowLeft />
          </IconButton>
          <Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-5" />
          <IconButton label="Report spam">
            <OctagonAlert />
          </IconButton>
          <IconButton label="Mark as unread" onClick={() => update({ is_read: false }, backToList)}>
            <MailIcon />
          </IconButton>
          <IconButton label="Delete">
            <Trash2 />
          </IconButton>
          <Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-5" />
          <IconButton label="Move to folder">
            <FolderInput />
          </IconButton>
          <IconButton label="More actions">
            <EllipsisVertical />
          </IconButton>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Previous mail" disabled={!prev} asChild={!!prev}>
            {prev ? (
              <Link to="/mail" search={(s) => ({ ...s, mail: prev.id })}>
                <ChevronUp />
              </Link>
            ) : (
              <ChevronUp />
            )}
          </IconButton>
          <IconButton label="Next mail" disabled={!next} asChild={!!next}>
            {next ? (
              <Link to="/mail" search={(s) => ({ ...s, mail: next.id })}>
                <ChevronDown />
              </Link>
            ) : (
              <ChevronDown />
            )}
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-start gap-3 border-b pb-4">
          <Avatar className="size-10">
            <AvatarFallback>{mailInitials(senderName(mail))}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
            <p className="truncate">
              <span className="font-semibold">{senderName(mail)}</span>{' '}
              {mail.from_name && <span className="text-muted-foreground">{mail.from_email}</span>}
            </p>
            {(mail.to.length > 0 || mail.cc.length > 0) && (
              <p className="text-muted-foreground">
                {mail.to.length > 0 && (
                  <>
                    <span className="text-foreground font-medium">To:</span>{' '}
                    <Contacts contacts={mail.to} />
                  </>
                )}
                {mail.cc.length > 0 && (
                  <>
                    {mail.to.length > 0 && '; '}
                    <span className="text-foreground font-medium">Cc:</span>{' '}
                    <Contacts contacts={mail.cc} />
                  </>
                )}
              </p>
            )}
          </div>
          <div className="text-muted-foreground flex shrink-0 items-center gap-0.5 text-sm">
            <span className="mr-1.5">{format(new Date(mail.received_at), 'MMM d, HH.mm')}</span>
            <IconButton label="Print" onClick={() => window.print()}>
              <Printer />
            </IconButton>
            <IconButton label="Forward">
              <Forward />
            </IconButton>
            <IconButton
              label={mail.is_starred ? 'Unstar' : 'Star'}
              aria-pressed={mail.is_starred}
              onClick={() => update({ is_starred: !mail.is_starred })}
            >
              <Star className={cn(mail.is_starred && 'fill-amber-400 text-amber-400')} />
            </IconButton>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-semibold">{mail.subject || '(no subject)'}</h1>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 text-sm text-blue-600 dark:text-blue-400">
              <Sparkles className="size-4" />
              {mail.importance
                ? `This email is considered as ${IMPORTANCE_LABELS[mail.importance].toLowerCase()}`
                : 'This email has not been classified yet'}
            </span>
            {mail.importance && (
              <>
                {/* Agreeing pins the AI's label as the user's; disagreeing flips it. */}
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Agree with importance"
                  aria-pressed={mail.importance_by === 'user'}
                  className={cn(mail.importance_by === 'user' && 'bg-accent')}
                  disabled={patch.isPending}
                  onClick={() => update({ importance: mail.importance! })}
                >
                  <ThumbsUp />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Disagree: mark as ${IMPORTANCE_LABELS[OTHER_IMPORTANCE[mail.importance]].toLowerCase()}`}
                  disabled={patch.isPending}
                  onClick={() => update({ importance: OTHER_IMPORTANCE[mail.importance!] })}
                >
                  <ThumbsDown />
                </Button>
              </>
            )}
          </div>
          <Button
            variant="outline"
            aria-expanded={summaryOpen}
            onClick={() => setSummaryOpen(!summaryOpen)}
          >
            <Sparkles />
            AI Email Summary
          </Button>
        </div>

        <Separator className="my-5" />

        {summaryOpen && (
          <section
            aria-label="AI email summary"
            aria-busy={!summaryText && summary.isPending}
            className="mb-6 max-w-3xl rounded-xl border border-l-4 border-violet-500/30 border-l-violet-500 bg-violet-500/5 p-4"
          >
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
              <Sparkles className="size-4" />
              AI Summary
            </p>
            {summaryText ? (
              <Markdown>{summaryText}</Markdown>
            ) : summary.isPending ? (
              <div className="grid gap-2">
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : summary.isError ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-destructive">{axiosErrorMessage(summary.error)}</span>
                <Button variant="outline" size="sm" onClick={() => summary.refetch()}>
                  <RotateCcw />
                  Try again
                </Button>
              </div>
            ) : null}
          </section>
        )}

        <MailBody html={mail.body_html} text={mail.body} />
      </div>

      <ReplyComposer key={mail.id} mailId={mail.id} />
    </div>
  )
}
