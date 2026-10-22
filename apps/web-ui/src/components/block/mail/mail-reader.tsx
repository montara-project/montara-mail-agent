import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  ArrowUp,
  AudioLines,
  ChevronDown,
  ChevronUp,
  EllipsisVertical,
  FileText,
  FolderInput,
  Forward,
  Mail as MailIcon,
  OctagonAlert,
  Plus,
  Printer,
  Trash2,
  X,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Mail } from '@/components/layout/mail/mail-data'

import { mailInitials, MAILS } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { queries } from '@/lib/api/queries'

function IconButton({ label, ...props }: React.ComponentProps<typeof Button> & { label: string }) {
  return <Button variant="ghost" size="icon" className="size-8" aria-label={label} title={label} {...props} />
}

/** Reading pane for one mail: toolbar, header, body, attachments and reply box. */
export default function MailReader({ mail }: { mail: Mail }) {
  const navigate = useNavigate()
  const { data: meData } = useQuery(queries.auth.profile())
  const [reply, setReply] = React.useState('')

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
        <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-6 text-sm">
          <span>
            <span className="text-foreground">From:</span> &lt;{mail.email}&gt;
          </span>
          {meData?.user && (
            <span>
              <span className="text-foreground">To:</span> &lt;{meData.user.email}&gt;
            </span>
          )}
        </p>

        <div className="mt-6 flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{mailInitials(mail.name)}</AvatarFallback>
          </Avatar>
          <div className="grid">
            <span className="font-medium">{mail.name}</span>
            <span className="text-muted-foreground text-sm">{mail.email}</span>
          </div>
        </div>

        <div className="text-muted-foreground mt-6 max-w-2xl text-[15px] leading-relaxed whitespace-pre-line">
          {mail.body}
        </div>

        {mail.attachments && (
          <div className="mt-8">
            <p className="text-sm">
              <span className="font-semibold">Attachment:</span>{' '}
              <span className="text-muted-foreground">{mail.attachments.length} file(s)</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {mail.attachments.map((file) => (
                <div key={file.name} className="bg-muted/50 flex items-center gap-3 rounded-lg border px-3 py-2.5">
                  <FileText className="text-primary size-7" />
                  <div className="grid text-sm">
                    <span>{file.name}</span>
                    <span className="text-muted-foreground text-xs">{file.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
