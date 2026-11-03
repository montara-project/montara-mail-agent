import { cn } from '@/lib/utils'

/** Provider → its brand color token (styles.css); anything else falls back to muted. */
const PROVIDER_COLOR: Record<string, string> = {
  gmail: 'var(--brand-gmail)',
  outlook: 'var(--brand-outlook)',
  proton: 'var(--brand-proton)',
  yahoo: 'var(--brand-yahoo)',
  icloud: 'var(--brand-icloud)',
}

/** The provider's brand color, or undefined when it has no brand token. */
export function providerColor(provider: string): string | undefined {
  return PROVIDER_COLOR[provider.toLowerCase()]
}

/**
 * A chip naming a mail provider in its brand color: a tint of the brand behind
 * it, the brand mixed toward the foreground as the text, since several brand
 * colors fall short of AA at full strength in one theme or the other. Providers
 * without a brand token (lark, zoho, imap, ...) show as a muted chip.
 */
export default function ProviderBadge({
  provider,
  className,
}: {
  provider: string
  className?: string
}) {
  const color = providerColor(provider)

  return (
    <span
      className={cn(
        'text-foreground inline-flex h-[21px] items-center rounded-chip px-2 text-[10.5px] font-semibold tracking-[0.2px] whitespace-nowrap capitalize',
        !color && 'bg-secondary text-muted-foreground',
        className
      )}
      style={
        color
          ? {
              color: `color-mix(in srgb, ${color} 55%, var(--foreground))`,
              backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
            }
          : undefined
      }
    >
      {provider}
    </span>
  )
}
