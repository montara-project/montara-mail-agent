import { authServices } from './auth'
import { emailAccountServices } from './email-account'
import { healthServices } from './health'
import { llmProviderServices } from './llm-provider'
import { mailServices } from './mail'
import { organizationServices } from './organization'

export const services = {
  health: healthServices,
  auth: authServices,
  organizations: organizationServices,
  emailAccounts: emailAccountServices,
  mails: mailServices,
  llmProvider: llmProviderServices,
} as const
