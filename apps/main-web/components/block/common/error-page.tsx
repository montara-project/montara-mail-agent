'use client'

import { IconAlertTriangle, IconArrowLeft, IconRefresh } from '@tabler/icons-react'
import Link from 'next/link'

import EmptyState from '@/components/block/common/empty-state'
import { Button } from '@/components/ui/button'

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
    <div className="flex min-h-svh items-center justify-center p-6">
      <EmptyState
        icon={IconAlertTriangle}
        title="Something went wrong"
        description={description}
        action={
          <div className="flex gap-2">
            <Button onClick={onRetry}>
              <IconRefresh />
              <span>Try again</span>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">
                <IconArrowLeft />
                <span>Back to dashboard</span>
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  )
}
