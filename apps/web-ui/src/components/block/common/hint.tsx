import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * A tooltip naming an icon-only control. The child must forward props and a
 * ref to its DOM element (a Button does), so it can also sit inside another
 * `asChild` trigger such as a dropdown's.
 */
export default function Hint({
  label,
  side,
  children,
}: {
  label: React.ReactNode
  side?: React.ComponentProps<typeof TooltipContent>['side']
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
