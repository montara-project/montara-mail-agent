import { authQueries } from './auth'
import { emailAccountQueries } from './email-account'
import { healthQueries } from './health'
import { llmProviderQueries } from './llm-provider'
import { mailQueries } from './mail'
import { organizationQueries } from './organization'

export const queries = {
  health: healthQueries,
  auth: authQueries,
  organizations: organizationQueries,
  emailAccounts: emailAccountQueries,
  mails: mailQueries,
  llmProvider: llmProviderQueries,
} as const
