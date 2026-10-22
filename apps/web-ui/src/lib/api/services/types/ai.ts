import type { AxiosItemResponse } from '@/types/api'

export type MailSummaryBody = {
  from: string
  subject: string
  body: string
}

export type AiResources = {
  mailSummary: (body: MailSummaryBody) => Promise<AxiosItemResponse<{ summary: string }>>
}
