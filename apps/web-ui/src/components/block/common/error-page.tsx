import { Link } from '@tanstack/react-router'
import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react'

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
    import.meta.env.DEV && error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.'

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        description={description}
        action={
          <div className="flex gap-2">
            <Button onClick={onRetry}>
              <RefreshCw />
              <span>Try again</span>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft />
                <span>Back to dashboard</span>
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  )
}
