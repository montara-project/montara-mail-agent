import type { AxiosError } from 'axios'

import { toast } from 'sonner'

import type { ApiErrorResponse } from '@/types/api'

/**
 * Extract a readable message from an API failure. Validation failures from the
 * Go API carry `errors: [{ code, field, message, param }]`; every message is
 * listed.
 */
export function axiosErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const body = error.response?.data as ApiErrorResponse | undefined
    const fieldMessages = (body?.errors ?? []).map((item) => item.message).filter(Boolean)

    if (fieldMessages.length > 0) {
      return `${body?.message || 'Validation failed'}:\n${fieldMessages.join('\n')}`
    }

    return body?.message || error.message || 'An error unknown occurred'
  }

  return error instanceof Error ? error.message : 'An error occurred'
}

/** Narrow an unknown error to an axios error without importing the class value. */
function isAxiosError(error: unknown): error is AxiosError {
  return (error as AxiosError | undefined)?.isAxiosError === true
}

export function throwAxiosError(error: unknown): never {
  throw new Error(axiosErrorMessage(error))
}

/** Toast the message extracted by {@link axiosErrorMessage}. */
export function toastAxiosError(error: unknown) {
  toast.error(axiosErrorMessage(error))
}
