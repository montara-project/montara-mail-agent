import { authServices } from './auth'
import { emailAccountServices } from './email-account'
import { llmProviderServices } from './llm-provider'
import { mailServices } from './mail'
import { organizationServices } from './organization'
import { profileServices } from './profile'

export const services = {
  auth: authServices,
  organizations: organizationServices,
  emailAccounts: emailAccountServices,
  mails: mailServices,
  llmProvider: llmProviderServices,
  profile: profileServices,
} as const
