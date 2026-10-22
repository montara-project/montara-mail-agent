import { authQueries } from './auth'
import { healthQueries } from './health'
import { organizationQueries } from './organization'

export const queries = {
  health: healthQueries,
  auth: authQueries,
  organizations: organizationQueries,
} as const
