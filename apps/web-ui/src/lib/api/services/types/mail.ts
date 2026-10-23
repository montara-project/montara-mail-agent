import type { AxiosItemResponse } from '@/types/api'

import type { Models } from '../../models'

export type MailPatchBody = {
  is_read?: boolean
  is_starred?: boolean
  importance?: Models.MailImportance
}

export type MailResources = {
  get: (id: string) => Promise<AxiosItemResponse<Models.Mail>>
  patch: (id: string, body: MailPatchBody) => Promise<AxiosItemResponse<Models.Mail>>
  summary: (id: string) => Promise<AxiosItemResponse<{ summary: string }>>
  replySuggestions: (id: string) => Promise<AxiosItemResponse<{ suggestions: string[] }>>
}
