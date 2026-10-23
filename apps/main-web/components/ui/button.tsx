'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Slot as SlotPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

// Outline and ghost dim their icons unless the icon sets its own color or opacity.
const dimIcons = '[&_svg:not([role=img]):not([class*=text-]):not([class*=opacity-])]:opacity-60'

const buttonVariants = cva(
  'cursor-pointer group whitespace-nowrap focus-visible:outline-hidden inline-flex items-center justify-center text-sm font-medium ring-offset-background transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs shadow-black/5',
        outline: `bg-background text-accent-foreground border border-input hover:bg-accent shadow-xs shadow-black/5 ${dimIcons}`,
        ghost: `text-accent-foreground hover:bg-accent hover:text-accent-foreground ${dimIcons}`,
      },
      size: {
        lg: 'h-10 px-4 text-sm gap-1.5 [&_svg:not([class*=size-])]:size-4',
        md: 'h-9 px-3 gap-1.5 text-sm [&_svg:not([class*=size-])]:size-4',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
