import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useMutation, useQuery } from '@tanstack/react-query'
import { $getRoot } from 'lexical'
import { RotateCcw, Sparkles, Wand2, X } from 'lucide-react'
import React from 'react'

import type { PromptCommand } from '@/components/ui/prompt-bar'
import type { Models } from '@/lib/api/models'

import Hint from '@/components/block/common/hint'
import { useEnabledSkills } from '@/components/block/mail/skill-menu'
import { SKILL_ICONS } from '@/components/block/skill/skill-list'
import { Button } from '@/components/ui/button'
import PromptBar from '@/components/ui/prompt-bar'
import StreamingText from '@/components/ui/streaming-text'
import ThinkingState from '@/components/ui/thinking-state'
import { useActiveAgentBot } from '@/hooks/use-active-agent-bot'
import { axiosErrorMessage } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'

/** The writer's / menu: common ways to answer, ready to send or extend. */
const REPLY_PROMPTS: PromptCommand[] = [
  { key: 'auto', name: '/auto', desc: 'A fitting reply', prompt: 'Write a fitting reply' },
  { key: 'accept', name: '/accept', desc: 'Agree and confirm', prompt: 'Accept and confirm' },
  { key: 'decline', name: '/decline', desc: 'Politely decline', prompt: 'Politely decline' },
  {
    key: 'ask',
    name: '/ask',
    desc: 'Ask a question back',
    prompt: 'Ask a clarifying question about ',
  },
  { key: 'meet', name: '/meet', desc: 'Propose a time', prompt: 'Propose meeting on ' },
  { key: 'formal', name: '/formal', desc: 'Formal and brief', prompt: 'Keep it formal and brief' },
]

/** What the panel is showing for review: a written reply or a polished draft. */
type Job = { kind: 'write' | 'polish'; title: string; run: () => void }

/** The editor's text as plain text, kept current; it lives inside the editor's provider. */
function useEditorText() {
  const [editor] = useLexicalComposerContext()
  const read = React.useCallback(
    () =>
      editor
        .getEditorState()
        .read(() => $getRoot().getTextContent())
        .trim(),
    [editor]
  )
  const [hasText, setHasText] = React.useState(() => read() !== '')
  React.useEffect(
    () => editor.registerUpdateListener(() => setHasText(read() !== '')),
    [editor, read]
  )
  return { read, hasText }
}

/**
 * Write with AI: the one place the reply's AI lives, docked above the editor's
 * bottom bar so it reads as a tool for the reply, not a second message. Quick
 * replies and polish run in one click; the prompt bar writes a whole reply from
 * an instruction. Every result waits here for review, and nothing reaches the
 * editor until "Use", so what is already typed is never lost by accident.
 */
export default function ReplyAiPanel({
  mailId,
  onInsert,
  onClose,
  onGrow,
}: {
  mailId: string
  /** puts text in the reply editor */
  onInsert: (text: string) => void
  onClose: () => void
  /** the panel got taller (a result is coming or came in); keeps what is below it in view */
  onGrow?: () => void
}) {
  const [instruction, setInstruction] = React.useState('')
  const { personas, activeBot, activeBotId, setActiveBotId } = useActiveAgentBot()
  const persona = activeBotId || undefined
  const editorText = useEditorText()
  const polishSkills = useEnabledSkills('draft')

  // Quick replies are a model call, made when the panel opens and kept per persona.
  const quick = useQuery(queries.mails.replySuggestions(mailId, activeBotId))
  const write = useMutation(queries.mails.draftReply(mailId))
  const polish = useMutation(queries.mails.runSkill(mailId))
  const [job, setJob] = React.useState<Job | null>(null)
  const mutation = job?.kind === 'polish' ? polish : write
  const result = job && mutation.isSuccess ? resultText(mutation.data) : undefined

  const startWrite = (text: string) => {
    const run = () => write.mutate({ instruction: text, agent_bot_id: persona })
    setJob({
      kind: 'write',
      title: activeBot ? `Written by ${activeBot.name}` : 'Written by AI',
      run,
    })
    run()
  }
  const startPolish = (skill: Models.AgentSkill) => {
    const draft = editorText.read()
    const run = () => polish.mutate({ key: skill.key, draft, agent_bot_id: persona })
    setJob({ kind: 'polish', title: skill.name, run })
    run()
  }
  const dismiss = () => {
    setJob(null)
    write.reset()
    polish.reset()
  }
  const use = (text: string) => {
    onInsert(text)
    setInstruction('')
    dismiss()
    onClose()
  }

  const busy = write.isPending || polish.isPending

  // Quick replies landing and a result's states each add height.
  const layoutKey = `${quick.status}:${job?.kind ?? ''}:${mutation.status}`
  React.useEffect(() => {
    onGrow?.()
  }, [layoutKey, onGrow])

  return (
    <section
      aria-label="Write with AI"
      className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-3 duration-200 ease-out motion-reduce:animate-none dark:bg-violet-400/[0.06]"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        <h3 className="text-sm font-medium">Write with AI</h3>
        <p className="text-muted-foreground hidden min-w-0 flex-1 truncate text-xs sm:block">
          Your reply only changes when you choose Use.
        </p>
        <Hint label="Close">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            aria-label="Close Write with AI"
            onClick={onClose}
          >
            <X />
          </Button>
        </Hint>
      </div>

      {job && (
        <div
          className="bg-background mb-3 rounded-lg border p-3"
          aria-live="polite"
          aria-busy={mutation.isPending}
        >
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">{job.title}</p>
          {mutation.isPending ? (
            <ThinkingState
              working
              rows={[]}
              active={
                job.kind === 'polish' ? `${job.title}: rewriting your draft` : 'Writing the reply'
              }
            />
          ) : mutation.isError ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-destructive">{axiosErrorMessage(mutation.error)}</span>
              <Button type="button" variant="outline" size="sm" onClick={job.run}>
                <RotateCcw />
                Try again
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          ) : (
            result && (
              <StreamingText
                key={mutation.submittedAt}
                text={result}
                onDone={onGrow}
                actions={
                  <div className="ml-auto flex gap-1.5">
                    <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
                      Discard
                    </Button>
                    <Button type="button" size="sm" onClick={() => use(result)}>
                      {job.kind === 'polish' ? 'Use this version' : 'Use this reply'}
                    </Button>
                  </div>
                }
              />
            )
          )}
        </div>
      )}

      <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">Quick replies</p>
          {quick.isPending ? (
            <ThinkingState
              working
              rows={[]}
              active={activeBot ? `${activeBot.name} is thinking` : 'Thinking of replies'}
            />
          ) : quick.isError ? (
            <button
              type="button"
              className="text-destructive text-xs underline underline-offset-2"
              onClick={() => quick.refetch()}
            >
              {axiosErrorMessage(quick.error)} Try again
            </button>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {quick.data.map((text) => (
                <Button
                  key={text}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-background h-auto max-w-full rounded-full py-1 text-left text-xs font-normal whitespace-normal"
                  disabled={busy}
                  onClick={() => use(text)}
                >
                  {text}
                </Button>
              ))}
            </div>
          )}
        </div>

        {polishSkills.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">
              {editorText.hasText ? 'Polish your draft' : 'Polish (write a draft first)'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {polishSkills.map((skill) => {
                const Icon = SKILL_ICONS[skill.key] ?? Wand2
                return (
                  <Button
                    key={skill.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-background h-7 rounded-full text-xs"
                    title={skill.description}
                    disabled={busy || !editorText.hasText}
                    onClick={() => startPolish(skill)}
                  >
                    <Icon />
                    {skill.name}
                  </Button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <PromptBar
        value={instruction}
        onChange={setInstruction}
        onSend={startWrite}
        busy={busy}
        label="Tell the AI what to reply"
        placeholder="Describe the reply you want, or type / for ideas…"
        commands={REPLY_PROMPTS}
        models={personas}
        model={activeBotId}
        onModelChange={setActiveBotId}
        modelLabel="Written by"
        sendLabel="Write"
      />
    </section>
  )
}

function resultText(data: string | Models.SkillRunResult) {
  if (typeof data === 'string') return data
  return 'text' in data ? data.text : undefined
}
