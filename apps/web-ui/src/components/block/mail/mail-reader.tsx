import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  EllipsisVertical,
  File as FileIcon,
  FolderInput,
  Forward,
  Mail as MailIcon,
  OctagonAlert,
  Paperclip,
  Printer,
  RotateCcw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Mail, MailContact } from '@/components/layout/mail/mail-data'

import Markdown from '@/components/block/common/markdown'
import ReplyComposer from '@/components/block/mail/reply-composer'
import { mailInitials, MAILS } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

function IconButton({ label, ...props }: React.ComponentProps<typeof Button> & { label: string }) {
  return <Button variant="ghost" size="icon" className="size-8" aria-label={label} title={label} {...props} />
}

/** "Name email" pairs, as in the To and Cc lines. */
function Contacts({ contacts }: { contacts: MailContact[] }) {
  return contacts.map((contact, i) => (
    <React.Fragment key={contact.email}>
      {i > 0 && ', '}
      <span className="text-foreground">{contact.name}</span> {contact.email}
    </React.Fragment>
  ))
}

// ponytail: downloads need a file endpoint; until then they only explain that.
const notAvailable = () => toast.info('Downloading attachments is not available yet')

/** Reading pane for one mail: toolbar, header, body, attachments and reply box. */
export default function MailReader({ mail }: { mail: Mail }) {
  const navigate = useNavigate()
  const { data: meData } = useQuery(queries.auth.profile())
  const [summaryOpen, setSummaryOpen] = React.useState(false)
  // Fetched on the first open only; the query keeps it for the session.
  const summary = useQuery({
    ...queries.ai.mailSummary(mail.id, {
      from: `${mail.name} <${mail.email}>`,
      subject: mail.subject,
      body: mail.body,
    }),
    enabled: summaryOpen,
  })
  const [starred, setStarred] = React.useState(!!mail.starred)
  // ponytail: importance feedback is local only; send it to the AI service once one exists.
  const [feedback, setFeedback] = React.useState<'up' | 'down' | null>(null)

  const index = MAILS.findIndex((item) => item.id === mail.id)
  const prev = MAILS[index - 1]
  const next = MAILS[index + 1]

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {/* ponytail: report, mark unread, move, delete and more have no backend yet. */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-0.5">
          <IconButton
            label="Back to list"
            onClick={() => navigate({ to: '/mail', search: (s) => ({ ...s, mail: undefined }) })}
          >
            <ArrowLeft />
          </IconButton>
          <Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-5" />
          <IconButton label="Report spam">
            <OctagonAlert />
          </IconButton>
          <IconButton label="Mark as unread">
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
            <AvatarFallback>{mailInitials(mail.name)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
            <p className="truncate">
              <span className="font-semibold">{mail.name}</span>{' '}
              <span className="text-muted-foreground">{mail.email}</span>
            </p>
            <p className="text-muted-foreground">
              {meData?.user && (
                <>
                  <span className="text-foreground font-medium">To:</span>{' '}
                  <Contacts contacts={[{ name: meData.user.name, email: meData.user.email }]} />
                </>
              )}
              {mail.cc && (
                <>
                  {meData?.user && '; '}
                  <span className="text-foreground font-medium">Cc:</span>{' '}
                  <Contacts contacts={mail.cc} />
                </>
              )}
            </p>
          </div>
          <div className="text-muted-foreground flex shrink-0 items-center gap-0.5 text-sm">
            {mail.attachments && <Paperclip className="mr-1.5 size-4" aria-label="Has attachments" />}
            <span className="mr-1.5">{format(new Date(mail.receivedAt), 'MMM d, HH.mm')}</span>
            <IconButton label="Print" onClick={() => window.print()}>
              <Printer />
            </IconButton>
            <IconButton label="Forward">
              <Forward />
            </IconButton>
            {/* ponytail: star is local only; persist it once mail lives on the server. */}
            <IconButton label={starred ? 'Unstar' : 'Star'} aria-pressed={starred} onClick={() => setStarred((on) => !on)}>
              <Star className={cn(starred && 'fill-amber-400 text-amber-400')} />
            </IconButton>
          </div>
        </div>

        <h1 className="mt-5 text-2xl font-semibold">{mail.subject}</h1>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 text-sm text-blue-600 dark:text-blue-400">
              <Sparkles className="size-4" />
              This email is considered as {mail.importance}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Agree with importance"
              aria-pressed={feedback === 'up'}
              className={cn(feedback === 'up' && 'bg-accent')}
              onClick={() => setFeedback((f) => (f === 'up' ? null : 'up'))}
            >
              <ThumbsUp />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Disagree with importance"
              aria-pressed={feedback === 'down'}
              className={cn(feedback === 'down' && 'bg-accent')}
              onClick={() => setFeedback((f) => (f === 'down' ? null : 'down'))}
            >
              <ThumbsDown />
            </Button>
          </div>
          <Button
            variant="outline"
            aria-expanded={summaryOpen}
            onClick={() => setSummaryOpen((open) => !open)}
          >
            <Sparkles />
            AI Email Summary
          </Button>
        </div>

        <Separator className="my-5" />

        {summaryOpen && (
          <section
            aria-label="AI email summary"
            aria-busy={summary.isPending}
            className="mb-6 max-w-3xl rounded-xl border border-l-4 border-violet-500/30 border-l-violet-500 bg-violet-500/5 p-4"
          >
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
              <Sparkles className="size-4" />
              AI Summary
            </p>
            {summary.isPending ? (
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
            ) : (
              <Markdown>{summary.data}</Markdown>
            )}
          </section>
        )}

        <div className="max-w-3xl text-[15px] leading-relaxed whitespace-pre-line">{mail.body}</div>

        {mail.attachments && (
          <>
            <Separator className="my-5" />
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Attachments</p>
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                onClick={notAvailable}
              >
                Download All ({mail.attachments.length})
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {mail.attachments.map((file) => (
                <button
                  key={file.name}
                  type="button"
                  onClick={notAvailable}
                  className="bg-muted/40 hover:bg-accent/50 flex items-center gap-3 rounded-xl border p-2 text-left text-sm"
                >
                  <span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg">
                    <FileIcon className="text-muted-foreground size-5" />
                  </span>
                  <span className="grid min-w-0">
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {file.name.split('.').pop()?.toUpperCase()} · {file.size}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <ReplyComposer key={mail.id} />
    </div>
  )
}
