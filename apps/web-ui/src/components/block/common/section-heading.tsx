import { cn } from '@/lib/utils'

/** A section's title and description, above its card, with an optional action. */
export default function SectionHeading({
  title,
  description,
  action,
  size = 'lg',
}: {
  title: string
  description: React.ReactNode
  action?: React.ReactNode
  /** sm: a 16px heading for a section nested under the page's own heading. */
  size?: 'lg' | 'sm'
}) {
  return (
    <div className="flex items-end gap-4">
      <div className={cn('grid min-w-0 flex-1', size === 'sm' ? 'gap-1' : 'gap-1.5')}>
        <h2
          className={cn(
            'font-bold',
            size === 'sm' ? 'text-base tracking-[-0.0125rem]' : 'text-2xl tracking-[-0.025rem]'
          )}
        >
          {title}
        </h2>
        <p
          className={cn(
            'text-muted-foreground text-pretty',
            size === 'sm' ? 'text-[0.78125rem]' : 'text-[0.875rem]'
          )}
        >
          {description}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
