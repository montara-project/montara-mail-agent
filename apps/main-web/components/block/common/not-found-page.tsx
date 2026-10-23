'use client'

import { IconArrowLeft, IconError404 } from '@tabler/icons-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

/** Full-page 404 for routes that do not exist. */
export default function NotFoundPage() {
  return (
    <div className="flex py-24 items-center justify-center p-6">
      <Empty className="py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-full">
            <IconError404 />
          </EmptyMedia>
          <EmptyTitle>Page not found</EmptyTitle>
          <EmptyDescription>
            The page you are looking for does not exist or has been moved.
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild>
          <Link href="/">
            <IconArrowLeft />
            <span>Back to home</span>
          </Link>
        </Button>
      </Empty>
    </div>
  )
}
