import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  ArrowUp,
  AudioLines,
  ChevronDown,
  ChevronUp,
  Download,
  EllipsisVertical,
  File as FileIcon,
  FolderInput,
  Forward,
  Mail as MailIcon,
  OctagonAlert,
  Plus,
  Printer,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Mail, MailContact } from '@/components/layout/mail/mail-data'

import { mailInitials, MAILS } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
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
  const [reply, setReply] = React.useState('')
  const [summaryOpen, setSummaryOpen] = React.useState(false)
  // ponytail: importance feedback is local only; send it to the AI service once one exists.
  const [feedback, setFeedback] = React.useState<'up' | 'down' | null>(null)

  const index = MAILS.findIndex((item) => item.id === mail.id)
  const prev = MAILS[index - 1]
  const next = MAILS[index + 1]

  const sendReply = (event: React.FormEvent) => {
    event.preventDefault()
    // ponytail: no send endpoint yet; wire this to the mail API once it exists.
    toast.info('Sending replies is not available yet')
  }

  return (
    // Viewport height minus the 4rem page header and 2rem of padding, so only the body scrolls.
    <div className="bg-card flex h-[calc(100svh-6rem)] flex-col rounded-xl border">
      {/* ponytail: report, mark unread, move, delete and more have no backend yet. */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-0.5">
          <IconButton label="Report spam">
            <OctagonAlert />
          </IconButton>
          <IconButton label="Mark as unread">
            <MailIcon />
          </IconButton>
          <IconButton label="Move to folder">
            <FolderInput />
          </IconButton>
          <IconButton label="Delete">
            <Trash2 />
          </IconButton>
          <IconButton label="More actions">
            <EllipsisVertical />
          </IconButton>
        </div>
        <IconButton
          label="Close"
          onClick={() => navigate({ to: '/mail', search: (s) => ({ ...s, mail: undefined }) })}
        >
          <X />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <p className="text-muted-foreground text-sm">
          {format(new Date(mail.receivedAt), 'MMMM d, yyyy • HH.mm')}
        </p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-lg">
            <span className="font-semibold">Subject:</span> {mail.subject}
          </h1>
          <div className="flex shrink-0 items-center gap-0.5">
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
            <IconButton label="Print" onClick={() => window.print()}>
              <Printer />
            </IconButton>
            <IconButton label="Forward">
              <Forward />
            </IconButton>
          </div>
        </div>
        <div className="mt-5 flex items-start gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{mailInitials(mail.name)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 gap-1 text-sm">
            <p>
              <span className="font-medium">{mail.name}</span>{' '}
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
        </div>

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

        {/* ponytail: the summary is sample text; fetch it from the AI service once it exists. */}
        {summaryOpen && (
          <div className="bg-muted/50 mt-3 rounded-lg border p-3 text-sm">
            <p className="mb-1 flex items-center gap-1.5 font-medium">
              <Sparkles className="size-4" />
              Summary
            </p>
            <p className="text-muted-foreground">{mail.summary}</p>
          </div>
        )}

        <Separator className="my-5" />

        <div className="max-w-3xl text-[15px] leading-relaxed whitespace-pre-line">{mail.body}</div>

        {mail.attachments && (
          <>
            <Separator className="my-5" />
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Attachment ({mail.attachments.length})</p>
              <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400" onClick={notAvailable}>
                <Download />
                Download All
              </Button>
            </div>
            <div className="bg-muted/40 mt-3 flex flex-wrap gap-3 rounded-xl border p-4">
              {mail.attachments.map((file) => (
                <div key={file.name} className="bg-card grid w-60 gap-3 rounded-xl border p-4">
                  <FileIcon className="size-5 text-blue-600 dark:text-blue-400" />
                  <span className="truncate text-sm font-medium">{file.name}</span>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{file.size}</span>
                    <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
                    <button
                      type="button"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                      onClick={notAvailable}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Magic UI rainbow-button animation, on the border only. */}
      <form
        onSubmit={sendReply}
        className="animate-rainbow m-4 rounded-xl border-2 border-transparent bg-[linear-gradient(var(--color-card),var(--color-card)),linear-gradient(90deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] bg-[length:200%] [background-clip:padding-box,border-box] [background-origin:border-box] p-2 motion-reduce:animate-none"
      >
        <Textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Reply to email..."
          aria-label="Reply to email"
          className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-between">
          <IconButton label="Attach file" type="button" variant="outline">
            <Plus />
          </IconButton>
          <div className="flex items-center gap-2">
            <IconButton label="Voice input" type="button" variant="outline">
              <AudioLines />
            </IconButton>
            <Button type="submit" size="icon" className="size-8" aria-label="Send reply" disabled={!reply.trim()}>
              <ArrowUp />
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
