import { useMutation, useQuery } from '@tanstack/react-query'
import { type LucideIcon, MessageSquare, PanelRight, SlidersHorizontal } from 'lucide-react'

import SectionHeading from '@/components/block/common/section-heading'
import { SettingsCard, SettingsPage } from '@/components/block/common/settings-card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

type Placement = 'beside' | 'floating'

const OPTIONS: {
  value: Placement
  icon: LucideIcon
  title: string
  description: string
}[] = [
  {
    value: 'beside',
    icon: PanelRight,
    title: 'Beside email detail',
    description: "The assistant sits as a third pane next to the message you're reading.",
  },
  {
    value: 'floating',
    icon: MessageSquare,
    title: 'Floating bottom right',
    description: "The assistant floats over the mail page in the corner, out of the reader's way.",
  },
]

/**
 * The assistant's defaults. Sending always waits for approval on the server, and
 * the other two aren't built, so every row here is fixed for now.
 */
const BEHAVIOUR = [
  {
    id: 'assistant-approval',
    label: 'Require approval before sending',
    description:
      'Every outgoing message from the assistant waits for your confirmation. Always on.',
    checked: true,
    soon: false,
  },
  {
    id: 'assistant-images',
    label: 'Read attached images',
    description: 'Lets the assistant OCR screenshots and photos in messages.',
    checked: false,
    soon: true,
  },
  {
    id: 'assistant-context',
    label: 'Remember context across threads',
    description: 'Reuse earlier conversations for better answers.',
    checked: false,
    soon: true,
  },
] as const

/** One placement: the row is the radio's whole label, so pointer and keyboard land together. */
function PlacementOption({
  option,
  selected,
  disabled,
  onSelect,
}: {
  option: (typeof OPTIONS)[number]
  selected: boolean
  disabled: boolean
  onSelect: (value: Placement) => void
}) {
  return (
    <label
      className={cn(
        'relative flex cursor-pointer items-center gap-3.5 px-[1.125rem] py-4',
        'has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:z-10 has-[:focus-visible]:ring-[0.1875rem] has-[:focus-visible]:outline-none',
        'has-[:disabled]:cursor-default has-[:disabled]:opacity-60 has-[:disabled]:hover:bg-transparent',
        'transition-colors duration-150 motion-reduce:transition-none',
        selected ? 'bg-accent-ink/4' : 'hover:bg-popover'
      )}
    >
      <input
        type="radio"
        name="agent-panel"
        value={option.value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(option.value)}
        className="sr-only"
      />
      <span
        className={cn(
          'grid size-[2.125rem] shrink-0 place-items-center rounded-[0.5625rem]',
          selected ? 'bg-accent-tint text-accent-soft' : 'bg-muted text-muted-foreground'
        )}
      >
        <option.icon className="size-4" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[0.84375rem] leading-[1.0625rem] font-semibold">{option.title}</span>
        <span className="text-ink-3 text-[0.78125rem] leading-4 text-pretty">
          {option.description}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          'grid size-[1.125rem] shrink-0 place-items-center rounded-full border',
          selected ? 'border-accent-ink bg-accent-ink' : 'border-input'
        )}
      >
        {selected && <span className="size-1.5 rounded-full bg-white" />}
      </span>
    </label>
  )
}

/** A default fixed for now: the switch shows its state but takes no input. */
function BehaviourRow({
  id,
  label,
  description,
  checked,
  soon,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  soon: boolean
}) {
  return (
    <div className="hover:border-input hover:bg-popover flex flex-wrap items-center gap-x-[0.6875rem] gap-y-2 rounded-[0.5625rem] border border-transparent px-[0.5625rem] py-2 transition-colors duration-150 motion-reduce:transition-none">
      <div className="grid min-w-0 flex-1 basis-[calc(100%-2.9375rem)] gap-px sm:basis-0">
        <Label htmlFor={id} className="text-[0.8125rem] leading-4 font-semibold">
          {label}
        </Label>
        <p
          id={`${id}-description`}
          className="text-ink-3 text-[0.71875rem] leading-[0.875rem] text-pretty"
        >
          {description}
        </p>
      </div>
      {soon && (
        <Badge variant="secondary" appearance="light" size="sm" className="shrink-0">
          Soon
        </Badge>
      )}
      <Switch
        id={id}
        size="sm"
        checked={checked}
        disabled
        aria-describedby={`${id}-description`}
        className={cn('w-9 disabled:cursor-default', !soon && 'disabled:opacity-100')}
        thumbClassName="w-4 data-[state=checked]:translate-x-[1.125rem] rtl:data-[state=checked]:-translate-x-[1.125rem]"
      />
    </div>
  )
}

/**
 * Control Center > Agent tools > AI Assistant Panel: where the assistant lives
 * in Mail, saved on the account like Split inbox.
 */
export default function AgentPanelSettings() {
  const { data: me, isPending } = useQuery(queries.auth.profile())
  const update = useMutation(queries.profile.updatePreferences())

  // The saved value, or the one on its way: a failed save falls back by itself.
  const value: Placement =
    update.isPending && update.variables?.agent_panel
      ? update.variables.agent_panel
      : (me?.user?.metadata?.agent_panel ?? 'beside')

  return (
    <SettingsPage>
      <SectionHeading
        title="AI Assistant Panel"
        description="Where the assistant lives in Mail. The choice follows your account across every device."
      />

      <div className="grid gap-5">
        <SettingsCard
          icon={PanelRight}
          tone="ai"
          body="flush"
          title="Placement"
          description="Where the assistant sits in Mail."
        >
          <div
            role="radiogroup"
            aria-label="Where the assistant sits in Mail"
            className="divide-border divide-y"
          >
            {OPTIONS.map((option) => (
              <PlacementOption
                key={option.value}
                option={option}
                selected={value === option.value}
                disabled={isPending || update.isPending}
                onSelect={(next) =>
                  update.mutate({ agent_panel: next }, { onError: toastAxiosError })
                }
              />
            ))}
          </div>
        </SettingsCard>

        <SettingsCard
          icon={SlidersHorizontal}
          tone="ai"
          title="Behaviour"
          description="Defaults for every new conversation."
        >
          {BEHAVIOUR.map((item) => (
            <BehaviourRow key={item.id} {...item} />
          ))}
        </SettingsCard>
      </div>
    </SettingsPage>
  )
}
