import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronDown, Reply, Settings2, Wand2, X } from 'lucide-react'

import type { Models } from '@/lib/api/models'

import Markdown from '@/components/block/common/markdown'
import { SKILL_ICONS } from '@/components/block/skill/skill-list'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import StreamingText from '@/components/ui/streaming-text'
import ThinkingState from '@/components/ui/thinking-state'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { queries } from '@/lib/api/queries'

/**
 * The active organization's skills that are switched on, built-in first;
 * with a target, only those that work on the email or on the reply draft.
 */
export function useEnabledSkills(target?: Models.AgentSkill['target']) {
  const { organization } = useActiveOrganization()
  const { data } = useQuery(queries.agentSkills.list(organization?.id ?? ''))
  return (data?.data ?? []).filter(
    (skill) => skill.is_enabled && (!target || skill.target === target)
  )
}

/** The reader's Skills menu: run one of the organization's skills on this email. */
export default function SkillMenu({
  disabled,
  onRun,
}: {
  disabled?: boolean
  onRun: (skill: Models.AgentSkill) => void
}) {
  // Draft skills rewrite the reply being written, so they live in its AI menu.
  const skills = useEnabledSkills('email')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Wand2 />
          Skills
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Run a skill on this email
        </DropdownMenuLabel>
        {skills.length === 0 && (
          <p className="text-muted-foreground px-2 py-1.5 text-sm">Every skill is turned off.</p>
        )}
        {skills.map((skill) => {
          const Icon = SKILL_ICONS[skill.key] ?? Wand2
          return (
            <DropdownMenuItem
              key={skill.key}
              className="items-start whitespace-normal"
              onSelect={() => onRun(skill)}
            >
              <Icon className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="font-medium">{skill.name}</span>
                {skill.description && (
                  <span className="text-muted-foreground text-xs">{skill.description}</span>
                )}
              </span>
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/skills">
            <Settings2 />
            Manage skills
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A skill run on the email: its thinking trace, then a custom skill's answer. */
export function SkillResult({
  name,
  pending,
  text,
  onUseAsReply,
  useLabel = 'Use as reply',
  onClose,
}: {
  name: string
  pending: boolean
  text?: string
  onUseAsReply: (text: string) => void
  useLabel?: string
  onClose: () => void
}) {
  return (
    <section
      aria-label={`${name} result`}
      aria-busy={pending}
      className="mb-6 max-w-3xl rounded-xl border border-l-4 border-violet-500/30 border-l-violet-500 bg-violet-500/5 p-4"
    >
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-violet-700 dark:text-violet-300">
        <Wand2 className="size-4" aria-hidden />
        <span className="flex-1">{name}</span>
        {!pending && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Close the result"
            onClick={onClose}
          >
            <X />
          </Button>
        )}
      </div>
      {pending ? (
        <ThinkingState working rows={[]} active={`Running ${name}`} />
      ) : (
        text && (
          <StreamingText
            text={text}
            render={(value) => <Markdown>{value}</Markdown>}
            actions={
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-6 text-xs"
                onClick={() => onUseAsReply(text)}
              >
                <Reply />
                {useLabel}
              </Button>
            }
          />
        )
      )}
    </section>
  )
}
