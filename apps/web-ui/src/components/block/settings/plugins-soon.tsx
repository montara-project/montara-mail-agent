import { Blocks, Puzzle } from 'lucide-react'

import SectionCard from '@/components/block/common/section-card'
import SectionHeading from '@/components/block/common/section-heading'

/** Placeholder registry rows: the shape of each plugin, none installable yet. */
const COMING = [
  {
    name: 'Calendar bridge · montara',
    description: 'Reads your calendar so the assistant can propose times that actually work.',
  },
  {
    name: 'PDF toolkit · community',
    description: 'Merges, splits and signs attachments without leaving Mail.',
  },
  {
    name: 'Team templates · montara',
    description: 'Shared reply templates that stay in sync across the organization.',
  },
] as const

/**
 * The Plugins page ahead of the feature: the registry isn't open yet, so the
 * first card says so and the second previews placeholder listings.
 */
export default function PluginsSoon() {
  return (
    <section className="grid gap-3">
      <SectionHeading
        title="Plugins"
        description="Extensions from the registry. They can add skills, providers and UI panels."
      />
      <SectionCard>
        <div className="flex items-start gap-3.5">
          {/* A plugin is an AI-adjacent thing, so its tile carries the AI accent. */}
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-accent-tint">
            <Puzzle className="size-4 text-[#a5a5ff]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold">The plugin registry opens soon</p>
              <span className="bg-muted rounded-tag px-[7px] py-[3px] font-mono text-[9.5px] font-semibold text-zinc-600">
                Soon
              </span>
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11.5px] text-pretty">
              Plugins will be reviewed before listing and run sandboxed. Until then you can connect
              the same capability through MCP.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Coming to the registry"
        description="Placeholder listings showing the shape of each plugin."
      >
        <div className="grid gap-3">
          {COMING.map((plugin) => (
            <div
              key={plugin.name}
              className="bg-muted flex items-center gap-3 rounded-[10px] border px-3 py-3"
            >
              <span className="grid size-[30px] shrink-0 place-items-center rounded-lg border">
                <Blocks className="text-ink-3 size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{plugin.name}</p>
                <p className="text-ink-3 text-[11px]">{plugin.description}</p>
              </div>
              <span className="rounded-[7px] border px-2.5 py-[5px] text-[11px] font-semibold text-zinc-600">
                Unavailable
              </span>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  )
}
