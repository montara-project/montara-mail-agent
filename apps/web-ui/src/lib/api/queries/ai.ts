import { queryOptions } from '@tanstack/react-query'

import type { MailSummaryBody } from '../services/types/ai'

import { services } from '../services'

export const AI_QUERY_KEY = 'ai'

/** A mail's AI summary. Each call costs a model request, so it is fetched once and kept. */
const mailSummary = (mailId: string, body: MailSummaryBody) =>
  queryOptions({
    queryKey: [AI_QUERY_KEY, 'mail-summary', mailId],
    queryFn: async () => {
      const res = await services.ai.mailSummary(body)
      return res.data.data.summary
    },
    staleTime: Infinity,
    retry: false,
  })

export const aiQueries = {
  mailSummary,
} as const
