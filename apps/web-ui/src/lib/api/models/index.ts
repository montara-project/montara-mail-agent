export namespace Models {
  export type Health = import('./health').Health
  export type Role = import('./role').Role
  export type User = import('./user').User
  export type MeData = import('./user').MeData
  export type SignInData = import('./user').SignInData
  export type Organization = import('./organization').Organization
  export type OrganizationStats = import('./organization').OrganizationStats
  export type EmailAccount = import('./email-account').EmailAccount
  export type EmailProvider = import('./email-account').EmailProvider
  export type Mail = import('./mail').Mail
  export type MailContact = import('./mail').MailContact
  export type MailFolder = import('./mail').MailFolder
  export type MailMoveTarget = import('./mail').MailMoveTarget
  export type MailImportance = import('./mail').MailImportance
  export type LLMProvider = import('./llm-provider').LLMProvider
  export type LLMProviderKind = import('./llm-provider').LLMProviderKind
}
