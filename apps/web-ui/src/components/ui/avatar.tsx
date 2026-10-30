'use client'

import { Avatar as AvatarPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn('relative flex size-10 shrink-0', className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <div className={cn('relative overflow-hidden rounded-full', className)}>
      <AvatarPrimitive.Image
        data-slot="avatar-image"
        className={cn('aspect-square h-full w-full')}
        {...props}
      />
    </div>
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'border-border bg-accent text-accent-foreground flex h-full w-full items-center justify-center rounded-full border text-xs',
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarFallback, AvatarImage }
