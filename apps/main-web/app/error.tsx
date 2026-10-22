'use client'

import { useRouter } from 'next/navigation'
import { startTransition } from 'react'

import ErrorPage from '@/components/block/common/error-page'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  // refresh() re-fetches server components; reset() then re-renders the segment.
  const retry = () =>
    startTransition(() => {
      router.refresh()
      reset()
    })

  return <ErrorPage error={error} onRetry={retry} />
}
