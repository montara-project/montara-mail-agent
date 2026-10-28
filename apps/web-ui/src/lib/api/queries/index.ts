import { activityLogQueries } from './activity-log'
import { agentQueries } from './agent'
import { agentBotQueries } from './agent-bot'
import { agentSkillQueries } from './agent-skill'
import { authQueries } from './auth'
import { emailAccountQueries } from './email-account'
import { llmProviderQueries } from './llm-provider'
import { mailQueries } from './mail'
import { mcpServerQueries } from './mcp-server'
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
  agentSkills: agentSkillQueries,
  mcpServers: mcpServerQueries,
} as const
