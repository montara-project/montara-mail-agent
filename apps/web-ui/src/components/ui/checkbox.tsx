import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Minus } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

// Define the variants for the Checkbox using cva.
const checkboxVariants = cva(
  `
    group peer bg-background shrink-0 rounded-md border border-input ring-offset-background focus-visible:outline-none
    transition-[background-color,border-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none 
    focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 
    aria-invalid:border-destructive/60 aria-invalid:ring-destructive/10 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/20
    [[data-invalid=true]_&]:border-destructive/60 [[data-invalid=true]_&]:ring-destructive/10  dark:[[data-invalid=true]_&]:border-destructive dark:[[data-invalid=true]_&]:ring-destructive/20,
    data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground
    `,
  {
    variants: {
      size: {
        sm: 'size-4.5 [&_svg]:size-3',
        md: 'size-5 [&_svg]:size-3.5',
        lg: 'size-5.5 [&_svg]:size-4',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

function Checkbox({
  className,
  size,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & VariantProps<typeof checkboxVariants>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ size }), className)}
      {...props}
    >
      {/* Mounted in every state, so unchecking can fade the mark out instead
          of dropping it; checking draws the tick (its path is ~23 units long). */}
      <CheckboxPrimitive.Indicator
        forceMount
        className="flex items-center justify-center text-current transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] data-[state=unchecked]:scale-75 data-[state=unchecked]:opacity-0 motion-reduce:transition-none"
      >
        <Check className="[stroke-dasharray:23] [stroke-dashoffset:23] transition-[stroke-dashoffset] delay-50 duration-300 ease-out group-data-[state=checked]:[stroke-dashoffset:0] group-data-[state=indeterminate]:hidden motion-reduce:transition-none motion-reduce:[stroke-dashoffset:0]" />
        <Minus className="hidden scale-x-0 transition-transform duration-200 ease-out group-data-[state=indeterminate]:block group-data-[state=indeterminate]:scale-x-100 motion-reduce:transition-none" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
