import { authQueries } from './auth'
import { emailAccountQueries } from './email-account'
import { healthQueries } from './health'
import { llmProviderQueries } from './llm-provider'
import { mailQueries } from './mail'
import { organizationQueries } from './organization'
import { profileQueries } from './profile'

export const queries = {
  health: healthQueries,
  auth: authQueries,
  organizations: organizationQueries,
  emailAccounts: emailAccountQueries,
  mails: mailQueries,
  llmProvider: llmProviderQueries,
  profile: profileQueries,
} as const
