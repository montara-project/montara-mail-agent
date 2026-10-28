import { activityLogServices } from './activity-log'
import { agentServices } from './agent'
import { agentBotServices } from './agent-bot'
import { agentSkillServices } from './agent-skill'
import { authServices } from './auth'
import { emailAccountServices } from './email-account'
import { llmProviderServices } from './llm-provider'
import { mailServices } from './mail'
import { mcpServerServices } from './mcp-server'
import { organizationServices } from './organization'
import { profileServices } from './profile'

export const services = {
  auth: authServices,
  organizations: organizationServices,
  emailAccounts: emailAccountServices,
  mails: mailServices,
  llmProvider: llmProviderServices,
  profile: profileServices,
  activityLog: activityLogServices,
  agent: agentServices,
  agentBots: agentBotServices,
  agentSkills: agentSkillServices,
  mcpServers: mcpServerServices,
} as const
