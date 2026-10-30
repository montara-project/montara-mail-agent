import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  FolderInput,
  Forward,
  Mail as MailIcon,
  MailOpen,
  OctagonAlert,
  ShieldCheck,
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

import type { Models } from '@/lib/api/models'

import Hint from '@/components/block/common/hint'
import Markdown from '@/components/block/common/markdown'
import SimpleAlertDialog from '@/components/block/common/simple-alert-dialog'
import ForwardDialog from '@/components/block/mail/forward-dialog'
import MailBody from '@/components/block/mail/mail-body'
import { useMailPage } from '@/components/block/mail/mail-list'
import { printMail } from '@/components/block/mail/print-mail'
import ReplyComposer from '@/components/block/mail/reply-composer'
import SkillMenu, { SkillResult } from '@/components/block/mail/skill-menu'
import { IMPORTANCE_LABELS, mailInitials, senderName } from '@/components/layout/mail/mail-data'
import {
  AccountFlag,
  MAIL_FOLDERS,
  MAIL_LABELS,
  useFlaggedAccount,
} from '@/components/layout/mail/mail-panel'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useActiveAgentBot } from '@/hooks/use-active-agent-bot'
import { useHideEmails } from '@/hooks/use-hide-emails'
import { axiosErrorMessage, toastAxiosError, toastProgress } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { clock, monthDay } from '@/lib/date'
import { cn } from '@/lib/utils'

function IconButton({ label, ...props }: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Hint label={label}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 pointer-coarse:size-10"
        aria-label={label}
        {...props}
      />
    </Hint>
  )
}

/** "Name email" pairs, as in the To and Cc lines. */
function Contacts({ contacts }: { contacts: Models.MailContact[] }) {
  const { mask } = useHideEmails()

  return contacts.map((contact, i) => (
    <React.Fragment key={contact.email}>
      {i > 0 && ', '}
      {contact.name && <span className="text-foreground">{mask(contact.name)}</span>}{' '}
      {mask(contact.email)}
    </React.Fragment>
  ))
}

const MOVE_TARGETS: Models.MailMoveTarget[] = ['inbox', 'archive', 'spam', 'trash']
const folderTitle = (id: Models.MailFolder) => MAIL_FOLDERS.find((f) => f.id === id)?.title ?? id

/** Reading pane for one mail: toolbar, header, AI importance and summary, body and reply box. */
export default function MailReader({ mailId }: { mailId: string }) {
  const navigate = useNavigate()
  const { data: mail, isPending, isError, error, refetch } = useQuery(queries.mails.get(mailId))
  const patch = useMutation(queries.mails.patch(mailId))
  const move = useMutation(queries.mails.move(mailId))
  const remove = useMutation(queries.mails.delete(mailId))
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)
  const [forwarding, setForwarding] = React.useState(false)
  // A kept summary shows right away; otherwise the panel waits for a click.
  const [summaryToggled, setSummaryOpen] = React.useState<boolean | null>(null)
  const summaryOpen = summaryToggled ?? !!mail?.summary
  // Asked for on the first open of a mail without one; the server keeps it after that.
  const summary = useQuery({
    ...queries.mails.summary(mailId),
    enabled: summaryOpen && !!mail && !mail.summary,
  })
  // A skill run with a bot answers its own summary, which the mail does not keep.
  const [skillSummary, setSkillSummary] = React.useState<string>()
  const summaryText = skillSummary ?? mail?.summary ?? summary.data

  // Skills: the run in flight, a custom skill's answer, and a reply draft for the composer.
  const runSkill = useMutation(queries.mails.runSkill(mailId))
  const { activeBotId } = useActiveAgentBot()
  const [skillRun, setSkillRun] = React.useState<{ name: string; text?: string } | null>(null)
  const [replyDraft, setReplyDraft] = React.useState<{ text: string; at: number }>()
  const [seenMailId, setSeenMailId] = React.useState(mailId)
  if (mailId !== seenMailId) {
    setSeenMailId(mailId)
    setSkillSummary(undefined)
    setSkillRun(null)
    setReplyDraft(undefined)
  }
  const run = (skill: Models.AgentSkill) => {
    setSkillRun({ name: skill.name })
    runSkill.mutate(
      // Translate answers in the reader's language; the other skills ignore it.
      { key: skill.key, agent_bot_id: activeBotId || undefined, language: navigator.language },
      {
        onSuccess: (result) => {
          if (result.kind === 'text') {
            setSkillRun({ name: skill.name, text: result.text })
            return
          }
          setSkillRun(null)
          if (result.kind === 'summary') {
            setSkillSummary(result.text)
            setSummaryOpen(true)
          } else if (result.kind === 'organize') {
            toast.success(`Labelled as ${IMPORTANCE_LABELS[result.importance].toLowerCase()}`)
          } else {
            setReplyDraft({ text: result.text, at: Date.now() })
          }
        },
        onError: (error) => {
          setSkillRun(null)
          toastAxiosError(error)
        },
      }
    )
  }

  // Opening a mail reads it.
  const markRead = React.useEffectEvent(() => {
    if (mail && !mail.is_read && !patch.isPending) patch.mutate({ is_read: true })
  })
  React.useEffect(() => markRead(), [mail?.id])

  // Prev/next walk the list page the mail was opened from.
  const { data: page } = useMailPage()
  const flaggedAccount = useFlaggedAccount()
  const { mask } = useHideEmails()
  const pageMails = page?.data ?? []
  const index = pageMails.findIndex((item) => item.id === mailId)
  const prev = index > 0 ? pageMails[index - 1] : undefined
  const next = index >= 0 ? pageMails[index + 1] : undefined

  const backToList = () => navigate({ to: '/mail', search: (s) => ({ ...s, mail: undefined }) })
  // Once the mail leaves this folder, the reader moves on to its neighbour, or back to the list.
  const leave = () =>
    navigate({ to: '/mail', search: (s) => ({ ...s, mail: next?.id ?? prev?.id }) })
  // Each of these signs in to the mail server, so the buttons wait for one to finish.
  const busy = move.isPending || remove.isPending

  // These sign in to the mail server and can take a few seconds, so a toast
  // shows them from start to finish.
  const moveTo = (folder: Models.MailMoveTarget) => {
    const progress = toastProgress(`Moving to ${folderTitle(folder)}...`)
    move.mutate(folder, {
      onSuccess: () => {
        progress.success(`Moved to ${folderTitle(folder)}`)
        leave()
      },
      onError: progress.error,
    })
  }
  const deleteMail = () => {
    const forever = mail?.folder === 'trash'
    const progress = toastProgress(forever ? 'Deleting forever...' : 'Moving to Trash...')
    remove.mutate(undefined, {
      onSuccess: () => {
        progress.success(forever ? 'Deleted forever' : 'Moved to Trash')
        leave()
      },
      onError: progress.error,
    })
  }
  const update = (body: Parameters<typeof patch.mutate>[0], then?: () => void) =>
    patch.mutate(body, { onSuccess: then, onError: toastAxiosError })

  if (isPending || isError || !mail) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-6" aria-busy={isPending}>
        {isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
            <p className="text-destructive">{axiosErrorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RotateCcw />
              Try again
            </Button>
            <Button variant="ghost" size="sm" onClick={backToList}>
              <ArrowLeft />
              Back to list
            </Button>
          </div>
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

  const flag = flaggedAccount(mail)

  const summaryContent = () => {
    if (summaryText) return <Markdown>{summaryText}</Markdown>
    if (summary.isPending) {
      return (
        <div className="grid gap-2">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )
    }
    if (summary.isError) {
      return (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-destructive">{axiosErrorMessage(summary.error)}</span>
          <Button variant="outline" size="sm" onClick={() => summary.refetch()}>
            <RotateCcw />
            Try again
          </Button>
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        {/* On a phone the actions may not all fit: the row scrolls instead of squeezing them. */}
        <div
          className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto"
          aria-busy={busy}
        >
          <IconButton label="Back to list" onClick={backToList}>
            <ArrowLeft />
          </IconButton>
          <Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-5" />
          {mail.folder !== 'archive' && (
            <IconButton label="Archive" disabled={busy} onClick={() => moveTo('archive')}>
              <Archive />
            </IconButton>
          )}
          {mail.folder === 'spam' ? (
            <IconButton label="Not spam" disabled={busy} onClick={() => moveTo('inbox')}>
              <ShieldCheck />
            </IconButton>
          ) : (
            <IconButton label="Report spam" disabled={busy} onClick={() => moveTo('spam')}>
              <OctagonAlert />
            </IconButton>
          )}
          <IconButton
            label={mail.folder === 'trash' ? 'Delete forever' : 'Delete'}
            disabled={busy}
            onClick={() => (mail.folder === 'trash' ? setConfirmingDelete(true) : deleteMail())}
          >
            <Trash2 />
          </IconButton>
          {mail.is_read ? (
            <IconButton
              label="Mark as unread"
              onClick={() => update({ is_read: false }, backToList)}
            >
              <MailIcon />
            </IconButton>
          ) : (
            <IconButton label="Mark as read" onClick={() => update({ is_read: true })}>
              <MailOpen />
            </IconButton>
          )}
          <Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-5" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label="Move to" disabled={busy}>
                <FolderInput />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Move to
              </DropdownMenuLabel>
              {MOVE_TARGETS.filter((folder) => folder !== mail.folder).map((folder) => {
                const Icon = MAIL_FOLDERS.find((f) => f.id === folder)!.icon
                return (
                  <DropdownMenuItem key={folder} onSelect={() => moveTo(folder)}>
                    <Icon />
                    {folderTitle(folder)}
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Label as
              </DropdownMenuLabel>
              {MAIL_LABELS.map((label) => (
                <DropdownMenuItem key={label.id} onSelect={() => update({ importance: label.id })}>
                  <span className={`${label.color} size-2.5 shrink-0 rounded-sm`} />
                  {label.title}
                  {mail.importance === label.id && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

      <div className="@container flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-start gap-3 border-b pb-4">
          <Avatar className="size-10">
            <AvatarFallback>{mailInitials(senderName(mail))}</AvatarFallback>
          </Avatar>
          {/* A narrow pane gives the sender the whole line; the date and actions wrap below. */}
          <div className="grid min-w-0 flex-1 basis-[calc(100%-3.25rem)] gap-0.5 text-sm @lg:basis-0">
            <p className="truncate">
              <span className="font-semibold">{mask(senderName(mail))}</span>{' '}
              {mail.from_name && (
                <span className="text-muted-foreground">{mask(mail.from_email)}</span>
              )}
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
            {/* A reply goes out from this account. */}
            {flag && (
              <p className="flex min-w-0 items-center gap-1.5">
                <span className="text-foreground shrink-0 font-medium">Received in:</span>
                <AccountFlag account={flag} />
              </p>
            )}
          </div>
          <div className="text-muted-foreground flex shrink-0 items-center gap-0.5 text-sm @max-lg:ms-13">
            <span className="mr-1.5">{`${monthDay(new Date(mail.received_at))}, ${clock(new Date(mail.received_at), '.')}`}</span>
            <IconButton label="Print" onClick={() => printMail(mail)}>
              <Printer />
            </IconButton>
            <IconButton label="Forward" onClick={() => setForwarding(true)}>
              <Forward />
            </IconButton>
            {/* The assistant pane is desktop only, like the button that opens it. */}
            <IconButton
              label="Ask AI about this email"
              className="hidden size-8 lg:inline-flex"
              onClick={() =>
                navigate({ to: '/mail', search: (s) => ({ ...s, agent: true, about: mail.id }) })
              }
            >
              <Sparkles />
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
            {/* The label's own hue, with the AI's sparkle for who decided it; wraps on narrow screens. */}
            <span
              className={cn(
                'flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                MAIL_LABELS.find((label) => label.id === mail.importance)?.tone ??
                  'bg-muted text-muted-foreground'
              )}
            >
              <Sparkles className="text-accent-ink size-4 shrink-0" aria-hidden />
              {mail.importance
                ? `This email is considered ${IMPORTANCE_LABELS[mail.importance].toLowerCase()}`
                : 'This email has not been classified yet'}
            </span>
            {mail.importance && (
              <>
                {/* Agreeing pins the AI's label as the user's; disagreeing picks another. */}
                <Hint label="Agree with importance">
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
                </Hint>
                <DropdownMenu>
                  <Hint label="Disagree: label it differently">
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Disagree: label it differently"
                        disabled={patch.isPending}
                      >
                        <ThumbsDown />
                      </Button>
                    </DropdownMenuTrigger>
                  </Hint>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                      Label as
                    </DropdownMenuLabel>
                    {MAIL_LABELS.filter((label) => label.id !== mail.importance).map((label) => (
                      <DropdownMenuItem
                        key={label.id}
                        onSelect={() => update({ importance: label.id })}
                      >
                        <span className={`${label.color} size-2.5 shrink-0 rounded-sm`} />
                        {label.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SkillMenu disabled={runSkill.isPending} onRun={run} />
            <Button
              variant="outline"
              aria-expanded={summaryOpen}
              onClick={() => setSummaryOpen(!summaryOpen)}
            >
              <Sparkles />
              AI Email Summary
            </Button>
          </div>
        </div>

        <Separator className="my-5" />

        {summaryOpen && (
          <section
            aria-label="AI email summary"
            aria-busy={!summaryText && summary.isPending}
            className="mb-6 max-w-3xl rounded-xl border border-accent-ink/25 bg-accent-ink/6 p-4"
          >
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-accent-ink">
              <Sparkles className="size-4" />
              AI Summary
            </p>
            {summaryContent()}
          </section>
        )}

        {skillRun && (
          <SkillResult
            name={skillRun.name}
            pending={runSkill.isPending}
            text={skillRun.text}
            onUseAsReply={(text) => setReplyDraft({ text, at: Date.now() })}
            onClose={() => setSkillRun(null)}
          />
        )}

        <MailBody html={mail.body_html} text={mail.body} />

        <ReplyComposer
          key={mail.id}
          mail={mail}
          draft={replyDraft}
          onForward={() => setForwarding(true)}
        />
      </div>

      {forwarding && <ForwardDialog mail={mail} onClose={() => setForwarding(false)} />}
      <SimpleAlertDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this email forever?"
        description="It is removed from the mail server too, and can't be brought back."
        confirmText="Delete forever"
        onConfirm={deleteMail}
      />
    </div>
  )
}
