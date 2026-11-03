import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardHeading,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  /** Without one the card has no header, for content labelled from outside. */
  title?: string
  /** Sits right after the title, such as a count. */
  badge?: React.ReactNode
  description?: string
  toolbar?: React.ReactNode
  children: React.ReactNode
}

/** One design card on the page: a single surface, no wrapper around it. */
export default function SectionCard({
  title,
  badge,
  description,
  toolbar,
  children,
}: SectionCardProps) {
  return (
    <Card className="w-full overflow-hidden rounded-lg border-border/60 shadow-hairline">
      {title && (
        <CardHeader
          className={cn('flex items-center px-4 py-3', description ? 'min-h-22' : 'min-h-11')}
        >
          <CardHeading className={cn('min-w-0 flex-1', description ? 'basis-56' : 'basis-auto')}>
            <div className="flex items-center gap-2">
              <CardTitle className="text-[0.90625rem] leading-[1.125rem] font-bold tracking-normal">
                {title}
              </CardTitle>
              {badge}
            </div>
            {description && (
              <CardDescription className="text-ink-3 text-sm">{description}</CardDescription>
            )}
          </CardHeading>

          {toolbar && <CardToolbar className="shrink-0">{toolbar}</CardToolbar>}
        </CardHeader>
      )}
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  )
}
