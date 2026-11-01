import { useMutation, useQuery } from '@tanstack/react-query'
import { PanelRight, PictureInPicture2 } from 'lucide-react'

import SectionCard from '@/components/block/common/section-card'
import SectionHeading from '@/components/block/common/section-heading'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const OPTIONS = [
  {
    value: 'beside' as const,
    icon: PanelRight,
    title: 'Beside email detail',
    description: "The assistant sits as a third pane next to the message you're reading.",
  },
  {
    value: 'floating' as const,
    icon: PictureInPicture2,
    title: 'Floating bottom right',
    description: "The assistant floats over the mail page in the corner, out of the reader's way.",
  },
]

/**
 * Control Center > Agent tools > AI Assistant Panel: where the assistant lives
 * in Mail, saved on the account like Split inbox.
 */
export default function AgentPanelSettings() {
  const { data: me, isPending } = useQuery(queries.auth.profile())
  const update = useMutation(queries.profile.updatePreferences())

  // The saved value, or the one on its way: a failed save falls back by itself.
  const value =
    update.isPending && update.variables?.agent_panel
      ? update.variables.agent_panel
      : (me?.user?.metadata?.agent_panel ?? 'beside')

  return (
    <div className="grid gap-4">
      <SectionHeading
        title="AI Assistant Panel"
        description="Where the assistant lives in Mail. The choice follows your account across every device."
      />
      <div className="grid gap-1.5">
        <h2 className="text-[9.5px] font-semibold uppercase text-ink-faint">Placement</h2>
        <SectionCard>
          <div role="radiogroup" aria-label="Panel position" className="grid gap-2">
            {OPTIONS.map((option) => {
              const selected = value === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={isPending || update.isPending}
                  onClick={() =>
                    update.mutate({ agent_panel: option.value }, { onError: toastAxiosError })
                  }
                  className={cn(
                    'flex w-full items-center gap-3.5 rounded-md py-4 px-[18px] text-left transition-colors outline-none',
                    'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                    selected
                      ? 'border-accent-ink/25 border bg-accent-tint/50'
                      : 'border-transparent hover:bg-accent/50'
                  )}
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-md',
                      selected ? 'bg-accent-tint text-accent-ink' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <option.icon className="size-4" aria-hidden />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-[12.5px] font-semibold">{option.title}</span>
                    <span className="text-ink-3 text-[11.5px]">{option.description}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-4.5 shrink-0 place-items-center rounded-full border',
                      selected ? 'border-accent-ink bg-accent-ink' : 'border-border bg-transparent'
                    )}
                  >
                    {selected && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                </button>
              )
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
