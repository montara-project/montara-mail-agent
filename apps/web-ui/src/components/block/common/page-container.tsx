import { cn } from '@/lib/utils'

/**
 * The centered column the Platform pages (Dashboard, Account, Control
 * Center) sit in. One shrinkable column, so wide content scrolls inside its
 * card instead of pushing the page past a phone's width.
 */
export default function PageContainer({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-4', className)}
      {...props}
    />
  )
}
