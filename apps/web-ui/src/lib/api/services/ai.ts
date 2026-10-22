import type { AiResources, MailSummaryBody } from './types/ai'

import { api } from '../client-fetch'

const path = '/api/v1/ai'

const resources = (): AiResources => ({
  mailSummary: (body: MailSummaryBody) => api.post(`${path}/mail-summary`, body),
})

export const aiServices = resources()
