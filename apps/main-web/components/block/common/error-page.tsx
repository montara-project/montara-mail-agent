'use client'

import { IconAlertTriangle, IconArrowLeft, IconRefresh } from '@tabler/icons-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

interface ErrorPageProps {
  error: unknown
  onRetry: () => void
}

/** Full-page fallback for errors thrown while rendering or loading a route. */
export default function ErrorPage({ error, onRetry }: ErrorPageProps) {
  // Raw messages can leak internals, so production shows a generic one.
  const description =
    process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.'

  return (
    <div className="flex py-24 items-center justify-center p-6">
      <Empty className="py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-full">
            <IconAlertTriangle />
          </EmptyMedia>
          <EmptyTitle>Something went wrong</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <div className="flex gap-2">
          <Button onClick={onRetry}>
            <IconRefresh />
            <span>Try again</span>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <IconArrowLeft />
              <span>Back to home</span>
            </Link>
          </Button>
        </div>
      </Empty>
    </div>
  )
}
