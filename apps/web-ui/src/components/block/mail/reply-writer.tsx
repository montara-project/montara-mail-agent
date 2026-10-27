import { useMutation } from '@tanstack/react-query'
import React from 'react'

import type { PromptCommand } from '@/components/ui/prompt-bar'

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

/**
 * Write the reply with AI: an instruction in a prompt bar, the persona that
 * writes it, then the draft revealed for review. Nothing reaches the editor
 * until "Use this reply", so what is already typed is never lost by accident.
 */
export default function ReplyWriter({
  mailId,
  onInsert,
}: {
  mailId: string
  /** puts the draft in the reply editor */
  onInsert: (text: string) => void
}) {
  const [instruction, setInstruction] = React.useState('')
  const { personas, activeBot, activeBotId, setActiveBotId } = useActiveAgentBot()
  const draft = useMutation(queries.mails.draftReply(mailId))

  const write = (text: string) =>
    draft.mutate({ instruction: text, agent_bot_id: activeBotId || undefined })

  return (
    <div className="grid gap-2">
      {draft.isPending && (
        <ThinkingState
          working
          rows={[]}
          active={activeBot ? `${activeBot.name} is writing the reply` : 'Writing the reply'}
        />
      )}
      {draft.isError && (
        <p role="alert" className="text-destructive text-sm">
          {axiosErrorMessage(draft.error)}
        </p>
      )}
      {draft.isSuccess && (
        <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 dark:bg-violet-400/10">
          <StreamingText
            key={draft.submittedAt}
            text={draft.data}
            actions={
              <div className="ml-auto flex gap-1.5">
                <Button type="button" variant="ghost" size="sm" onClick={() => draft.reset()}>
                  Discard
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onInsert(draft.data)
                    draft.reset()
                    setInstruction('')
                  }}
                >
                  Use this reply
                </Button>
              </div>
            }
          />
        </div>
      )}
      <PromptBar
        value={instruction}
        onChange={setInstruction}
        onSend={write}
        busy={draft.isPending}
        label="Tell the AI what to reply"
        placeholder="Tell the AI what to reply, or type / for ideas…"
        commands={REPLY_PROMPTS}
        models={personas}
        model={activeBotId}
        onModelChange={setActiveBotId}
        modelLabel="Written by"
      />
    </div>
  )
}
