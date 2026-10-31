import { useMutation, useQuery } from '@tanstack/react-query'
import { Check } from 'lucide-react'

import SectionCard from '@/components/block/common/section-card'
import { toastAxiosError } from '@/lib/api/axios-error'
import { queries } from '@/lib/api/queries'
import { cn } from '@/lib/utils'

const OPTIONS = [
  {
    value: 'beside' as const,
    title: 'Beside email detail',
    description: "The assistant sits as the third pane next to the email you're reading.",
  },
  {
    value: 'floating' as const,
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
    <SectionCard
      title="AI Assistant Panel"
      description="Where the AI assistant lives in Mail. The choice follows your account across devices."
    >
      <div role="radiogroup" aria-label="Panel position" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={isPending || update.isPending}
            onClick={() =>
              update.mutate({ agent_panel: option.value }, { onError: toastAxiosError })
            }
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors',
              'focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
              value === option.value ? 'border-accent-ink/60 bg-accent/20' : 'hover:bg-accent/50'
            )}
          >
            <span className="flex w-full items-center justify-between text-sm font-medium">
              {option.title}
              {value === option.value && <Check className="text-accent-ink size-4" />}
            </span>
            <span className="text-muted-foreground text-xs leading-5">{option.description}</span>
          </button>
        ))}
      </div>
    </SectionCard>
  )
}
