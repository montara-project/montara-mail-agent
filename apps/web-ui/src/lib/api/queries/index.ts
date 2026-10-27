import { activityLogQueries } from './activity-log'
import { agentQueries } from './agent'
import { agentBotQueries } from './agent-bot'
import { authQueries } from './auth'
import { emailAccountQueries } from './email-account'
import { llmProviderQueries } from './llm-provider'
import { mailQueries } from './mail'
import { organizationQueries } from './organization'
import { profileQueries } from './profile'

export const queries = {
  auth: authQueries,
  organizations: organizationQueries,
  emailAccounts: emailAccountQueries,
  mails: mailQueries,
  llmProvider: llmProviderQueries,
  profile: profileQueries,
  activityLog: activityLogQueries,
  agent: agentQueries,
  agentBots: agentBotQueries,
} as const
