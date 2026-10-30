import { Link } from '@tanstack/react-router'
import { ArrowLeft, SearchX } from 'lucide-react'

import EmptyState from '@/components/block/common/empty-state'
import { Button } from '@/components/ui/button'

/** Full-page 404 for routes that do not exist. */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <EmptyState
        icon={SearchX}
        title="Page not found"
        description="The page you are looking for does not exist or has been moved."
        action={
          <Button asChild>
            <Link to="/dashboard">
              <ArrowLeft />
              <span>Back to dashboard</span>
            </Link>
          </Button>
        }
      />
    </div>
  )
}
