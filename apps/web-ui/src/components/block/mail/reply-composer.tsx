import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useMutation, useQuery } from '@tanstack/react-query'
import { $getRoot } from 'lexical'
import { ChevronDown, Forward, Reply as ReplyIcon, RotateCcw, Sparkles, Wand2 } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import type { Models } from '@/lib/api/models'

import AgentBotRadioGroup from '@/components/block/agent-bot/agent-bot-radio-group'
import { SkillResult, useEnabledSkills } from '@/components/block/mail/skill-menu'
import { SKILL_ICONS } from '@/components/block/skill/skill-list'
import { mailInitials } from '@/components/layout/mail/mail-data'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import StreamingText from '@/components/ui/streaming-text'
import ThinkingState from '@/components/ui/thinking-state'
import { useActiveAgentBot } from '@/hooks/use-active-agent-bot'
import { axiosErrorMessage, toastAxiosError, toastProgress } from '@/lib/api/axios-error'
import { allEmails, MAX_RECIPIENTS } from '@/lib/api/dtos/mail/recipients'
import { queries } from '@/lib/api/queries'

import type { Reply } from './mail-editor'

import RecipientInput from './recipient-input'
import ReplyWriter from './reply-writer'

const MailEditor = React.lazy(() => import('./mail-editor'))

/**
 * "Use AI": up to three suggested replies, asked for when the menu opens since
 * each is a model call. With agent bots set up, a Persona section picks who
 * writes them; a new pick asks again. Polish runs a draft skill (humanize,
 * copy edit) on what is in the editor; it renders inside the editor, so it
 * reads the text straight from it.
 */
function AiMenu({
  mailId,
  onPick,
  onPolish,
}: {
  mailId: string
  onPick: (text: string) => void
  onPolish: (skill: Models.AgentSkill, draft: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const { bots, activeBot, activeBotId } = useActiveAgentBot()
  const [editor] = useLexicalComposerContext()
  const polishSkills = useEnabledSkills('draft')
  const polish = (skill: Models.AgentSkill) => {
    const draft = editor
      .getEditorState()
      .read(() => $getRoot().getTextContent())
      .trim()
    if (!draft) {
      toast.error(`Write your reply first, then ${skill.name.toLowerCase()} it`)
      return
    }
    onPolish(skill, draft)
  }
  const { data, dataUpdatedAt, isFetching, isError, error, refetch } = useQuery({
    ...queries.mails.replySuggestions(mailId, activeBotId),
    enabled: open,
  })
  // New suggestions reveal once; reopening the menu shows them settled.
  const [revealedAt, setRevealedAt] = React.useState(0)
  const reveal = dataUpdatedAt > revealedAt

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
        {polishSkills.length > 0 && (
          <>
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Polish your draft
            </DropdownMenuLabel>
            {polishSkills.map((skill) => {
              const Icon = SKILL_ICONS[skill.key] ?? Wand2
              return (
                <DropdownMenuItem
                  key={skill.key}
                  className="items-start whitespace-normal"
                  onSelect={() => polish(skill)}
                >
                  <Icon className="mt-0.5" />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{skill.name}</span>
                    <span className="text-muted-foreground text-xs">{skill.description}</span>
                  </span>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
          </>
        )}
        {bots.length > 0 && (
          <>
            <DropdownMenuLabel className="text-muted-foreground text-xs">Persona</DropdownMenuLabel>
            <AgentBotRadioGroup keepOpen />
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Suggested replies
        </DropdownMenuLabel>
        {isFetching ? (
          <div className="px-2 py-1" aria-busy="true">
            <ThinkingState
              working
              rows={[]}
              active={activeBot ? `${activeBot.name} is thinking` : 'Thinking of replies'}
            />
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
          data?.map((text, i) => (
            <DropdownMenuItem
              key={text}
              className="whitespace-normal"
              onSelect={() => onPick(text)}
            >
              <StreamingText
                text={text}
                animate={reveal}
                copy={false}
                onDone={i === data.length - 1 ? () => setRevealedAt(dataUpdatedAt) : undefined}
              />
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
  // A draft skill's rewrite of the editor's text, shown for review before it replaces it.
  const polishRun = useMutation(queries.mails.runSkill(mail.id))
  const { activeBotId } = useActiveAgentBot()
  const [polished, setPolished] = React.useState<{ name: string; text?: string } | null>(null)
  const polish = (skill: Models.AgentSkill, text: string) => {
    setPolished({ name: skill.name })
    polishRun.mutate(
      { key: skill.key, draft: text, agent_bot_id: activeBotId || undefined },
      {
        onSuccess: (result) =>
          setPolished('text' in result ? { name: skill.name, text: result.text } : null),
        onError: (error) => {
          setPolished(null)
          toastAxiosError(error)
        },
      }
    )
  }

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
    setPolished(null)
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
        <MailEditor
          initial={initial}
          placeholder="Write your reply..."
          onSend={send}
          onCancel={close}
          sending={reply.isPending}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          leading={
            <AiMenu mailId={mail.id} onPick={(text) => setInitial({ text })} onPolish={polish} />
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
              {polished && (
                <SkillResult
                  name={polished.name}
                  pending={polishRun.isPending}
                  text={polished.text}
                  useLabel="Use this version"
                  onUseAsReply={(text) => {
                    setInitial({ text })
                    setPolished(null)
                  }}
                  onClose={() => setPolished(null)}
                />
              )}
              <div className="border-t pt-3">
                <ReplyWriter mailId={mail.id} onInsert={(text) => setInitial({ text })} />
              </div>
            </div>
          }
        />
      </React.Suspense>
    </div>
  )
}
