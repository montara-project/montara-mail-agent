import { ArrowUpRight, Blocks, Info, Puzzle } from 'lucide-react'

import SectionHeading from '@/components/block/common/section-heading'
import { SettingsCard, SettingsPage } from '@/components/block/common/settings-card'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

/** Where a plugin request goes: the marketing site's contact page. */
const REQUEST_URL = 'https://www.montaramail.web.id/contact'

/** Placeholder registry rows: the shape of each plugin, none installable yet. */
const PLANNED = [
  {
    name: 'Calendar bridge · montara',
    description: 'Reads your calendar so the assistant can propose times that actually work.',
    eta: 'Q1 2027',
  },
  {
    name: 'PDF toolkit · community',
    description: 'Merges, splits and signs attachments without leaving Mail.',
    eta: 'Q1 2027',
  },
  {
    name: 'Team templates · montara',
    description: 'Shared reply templates that stay in sync across the organization.',
    eta: 'Q2 2027',
  },
] as const

/**
 * The Plugins page ahead of the feature: the registry isn't open yet, so the
 * first card says so and the second previews placeholder listings.
 */
export default function PluginsSoon() {
  return (
    <SettingsPage>
      <SectionHeading
        title="Plugins"
        description="Extensions from the registry. They can add skills, providers and UI panels."
      />

      <div className="grid gap-5">
        <Card className="rounded-lg shadow-none">
          <div className="flex items-start gap-3.5 p-[1.125rem]">
            {/* A plugin is an AI-adjacent thing, so its tile carries the AI accent. */}
            <span className="bg-accent-tint grid size-[2.125rem] shrink-0 place-items-center rounded-[0.5625rem]">
              <Puzzle className="text-accent-soft size-4" aria-hidden />
            </span>
            <div className="grid min-w-0 flex-1 gap-[0.1875rem]">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[0.875rem] leading-[1.0625rem] font-bold">
                  The plugin registry opens soon
                </h3>
                <Badge variant="secondary" appearance="light" size="sm">
                  Soon
                </Badge>
              </div>
              <p className="text-ink-2 text-[0.78125rem] leading-4 text-pretty">
                Plugins will be reviewed before listing and run sandboxed. Until then you can
                connect the same capability through MCP.
              </p>
            </div>
          </div>
        </Card>

        <SettingsCard
          icon={Blocks}
          tone="ai"
          title="Coming to the registry"
          description="Placeholder listings showing the shape of each plugin"
          count={PLANNED.length}
          noun="planned"
          footer={
            <>
              <p className="text-ink-3 flex items-start gap-[0.3125rem] text-[0.71875rem] leading-[0.875rem]">
                <Info className="mt-px size-[0.6875rem] shrink-0" aria-hidden />
                Listings are read-only until their plugin ships
              </p>
              <a
                href={REQUEST_URL}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 pointer-coarse:h-11 inline-flex items-center gap-1 rounded-[0.3125rem] text-[0.71875rem] leading-[0.875rem] font-semibold outline-none transition-colors duration-150 focus-visible:ring-[0.1875rem] motion-reduce:transition-none"
              >
                Request a plugin
                <ArrowUpRight className="size-[0.6875rem]" aria-hidden />
              </a>
            </>
          }
        >
          {/* Nothing here is installable yet, so the rows carry no hover or press state. */}
          <ul className="grid gap-0.5">
            {PLANNED.map((plugin) => (
              <li
                key={plugin.name}
                className="flex flex-wrap items-center gap-x-[0.6875rem] gap-y-2 rounded-[0.5625rem] px-2.5 py-[0.5625rem]"
              >
                <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-[0.5rem]">
                  <Blocks className="text-ink-3 size-[0.8125rem]" aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1 basis-[calc(100%-2.4375rem)] gap-px sm:basis-0">
                  <span className="text-ink-2 text-xs leading-4 font-semibold wrap-anywhere">
                    {plugin.name}
                  </span>
                  <span className="text-ink-3 text-[0.71875rem] leading-[0.875rem] text-pretty">
                    {plugin.description}
                  </span>
                </span>
                <span className="bg-muted text-ink-faint shrink-0 rounded-[0.25rem] px-[0.3125rem] py-px font-mono text-[0.6875rem] leading-3 font-semibold tracking-[0.025rem]">
                  {plugin.eta}
                </span>
                <span className="text-ink-faint border-border shrink-0 rounded-[0.375rem] border px-2.5 py-1 text-[0.71875rem] leading-[0.9375rem] font-semibold">
                  Unavailable
                </span>
              </li>
            ))}
          </ul>
        </SettingsCard>
      </div>
    </SettingsPage>
  )
}
