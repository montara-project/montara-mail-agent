import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { Slot as SlotPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'cursor-pointer group rounded-md whitespace-nowrap focus-visible:outline-hidden inline-flex items-center justify-center has-data-[arrow=true]:justify-between whitespace-nowrap text-sm font-medium ring-offset-background transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/90 data-[state=open]:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 data-[state=open]:bg-destructive/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/90 data-[state=open]:bg-secondary/90',
        outline:
          'bg-background text-accent-foreground border border-input hover:bg-accent data-[state=open]:bg-accent',
        ghost:
          'text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
        dim: 'text-muted-foreground hover:text-foreground data-[state=open]:text-foreground',
      },
      underline: {
        solid: '',
      },
      underlined: {
        solid: '',
      },
      size: {
        md: 'h-9 px-3 gap-1.5 text-sm [&_svg:not([class*=size-])]:size-4',
        sm: 'h-8 px-2.5 gap-1.25 text-xs [&_svg:not([class*=size-])]:size-3.5',
        xs: 'h-7 px-2 gap-1 text-xs [&_svg:not([class*=size-])]:size-3.5',
        icon: 'size-9 [&_svg:not([class*=size-])]:size-4 shrink-0',
      },
      mode: {
        default: 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        icon: 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0',
        link: 'text-primary h-auto p-0 bg-transparent rounded-none hover:bg-transparent data-[state=open]:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        input: `
            justify-start font-normal hover:bg-background [&_svg]:transition-colors [&_svg]:hover:text-foreground data-[state=open]:bg-background 
            focus-visible:border-ring focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/30 
            [[data-state=open]>&]:border-ring [[data-state=open]>&]:outline-hidden [[data-state=open]>&]:ring-[3px] 
            [[data-state=open]>&]:ring-ring/30 
            aria-invalid:border-destructive/60 aria-invalid:ring-destructive/10 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/20
            in-data-[invalid=true]:border-destructive/60 in-data-[invalid=true]:ring-destructive/10  dark:in-data-[invalid=true]:border-destructive dark:in-data-[invalid=true]:ring-destructive/20
          `,
      },
      placeholder: {
        true: 'text-muted-foreground',
        false: '',
      },
    },
    compoundVariants: [
      // Icons opacity for default mode
      {
        variant: 'ghost',
        mode: 'default',
        className: '[&_svg:not([role=img]):not([class*=text-]):not([class*=opacity-])]:opacity-60',
      },
      {
        variant: 'outline',
        mode: 'default',
        className: '[&_svg:not([role=img]):not([class*=text-]):not([class*=opacity-])]:opacity-60',
      },
      {
        variant: 'secondary',
        mode: 'default',
        className: '[&_svg:not([role=img]):not([class*=text-]):not([class*=opacity-])]:opacity-60',
      },

      // Icons opacity for default mode
      {
        variant: 'outline',
        mode: 'input',
        className: '[&_svg:not([role=img]):not([class*=text-]):not([class*=opacity-])]:opacity-60',
      },
      {
        variant: 'outline',
        mode: 'icon',
        className: '[&_svg:not([role=img]):not([class*=text-]):not([class*=opacity-])]:opacity-60',
      },

      // Shadow support
      {
        variant: 'primary',
        mode: 'default',
        className: 'shadow-xs shadow-black/5',
      },
      {
        variant: 'secondary',
        mode: 'default',
        className: 'shadow-xs shadow-black/5',
      },
      {
        variant: 'outline',
        mode: 'default',
        className: 'shadow-xs shadow-black/5',
      },
      {
        variant: 'destructive',
        mode: 'default',
        className: 'shadow-xs shadow-black/5',
      },

      // Shadow support
      {
        variant: 'primary',
        mode: 'icon',
        className: 'shadow-xs shadow-black/5',
      },
      {
        variant: 'secondary',
        mode: 'icon',
        className: 'shadow-xs shadow-black/5',
      },
      {
        variant: 'outline',
        mode: 'icon',
        className: 'shadow-xs shadow-black/5',
      },
      {
        variant: 'destructive',
        mode: 'icon',
        className: 'shadow-xs shadow-black/5',
      },

      // Link
      {
        variant: 'primary',
        mode: 'link',
        underline: 'solid',
        className:
          'font-medium text-primary hover:text-primary/90 [&_svg:not([role=img]):not([class*=text-])]:opacity-60 hover:underline hover:underline-offset-4 hover:decoration-solid',
      },
      {
        variant: 'primary',
        mode: 'link',
        underlined: 'solid',
        className:
          'font-medium text-primary hover:text-primary/90 [&_svg:not([role=img]):not([class*=text-])]:opacity-60 underline underline-offset-4 decoration-solid',
      },

      // Ghost
      {
        variant: 'ghost',
        mode: 'icon',
        className: 'text-muted-foreground',
      },

      // Size
      {
        size: 'xs',
        mode: 'icon',
        className: 'w-7 h-7 p-0 [[&_svg:not([class*=size-])]:size-3.5',
      },
      {
        size: 'sm',
        mode: 'icon',
        className: 'w-8 h-8 p-0 [[&_svg:not([class*=size-])]:size-3.5',
      },
      {
        size: 'md',
        mode: 'icon',
        className: 'w-9 h-9 p-0 [&_svg:not([class*=size-])]:size-4',
      },
      {
        size: 'icon',
        className: 'w-9 h-9 p-0 [&_svg:not([class*=size-])]:size-4',
      },

      // Input mode
      {
        mode: 'input',
        placeholder: true,
        variant: 'outline',
        className: 'font-normal text-muted-foreground',
      },
      {
        mode: 'input',
        variant: 'outline',
        size: 'sm',
        className: 'gap-1.25',
      },
      {
        mode: 'input',
        variant: 'outline',
        size: 'md',
        className: 'gap-1.5',
      },
    ],
    defaultVariants: {
      variant: 'primary',
      mode: 'default',
      size: 'md',
    },
  }
)

function Button({
  className,
  variant,
  mode,
  size,
  underlined,
  underline,
  asChild = false,
  placeholder = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(
        buttonVariants({
          variant,
          size,
          mode,
          placeholder,
          underlined,
          underline,
          className,
        }),
        asChild && props.disabled && 'pointer-events-none opacity-50'
      )}
      {...props}
    />
  )
}

interface ButtonArrowProps extends React.SVGProps<SVGSVGElement> {
  icon?: LucideIcon // Allows passing any Lucide icon
}

function ButtonArrow({ icon: Icon = ChevronDown, className, ...props }: ButtonArrowProps) {
  return <Icon data-slot="button-arrow" className={cn('ms-auto -me-1', className)} {...props} />
}

export { Button, ButtonArrow, buttonVariants }
