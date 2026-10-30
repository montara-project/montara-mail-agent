import { RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { axiosErrorMessage } from '@/lib/api/axios-error'

/**
 * What a list card shows for its query: the loading placeholder, the error
 * with a retry, the empty state, or the list itself.
 */
export default function QueryState({
  isPending,
  isError,
  error,
  onRetry,
  isEmpty,
  loading,
  empty,
  children,
}: {
  isPending: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  isEmpty: boolean
  loading: React.ReactNode
  empty: React.ReactNode
  children: React.ReactNode
}) {
  if (isPending) return loading
  if (isError) {
    return (
      <div role="alert" className="grid justify-items-center gap-3 p-6 text-center text-sm">
        <p className="text-destructive">{axiosErrorMessage(error)}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw />
          Try again
        </Button>
      </div>
    )
  }
  if (isEmpty) return empty
  return children
}
