import { authServices } from './auth'
import { healthServices } from './health'
import { organizationServices } from './organization'

export const services = {
  health: healthServices,
  auth: authServices,
  organizations: organizationServices,
} as const
