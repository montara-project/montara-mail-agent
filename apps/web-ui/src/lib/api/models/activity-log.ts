import type { ISO8601DateString } from '@/types/time'

/**
 * The actions the API records (apps/server internal/lib/constant/activity.go).
 * The word before the dot is the area, the one after it the event.
 */
export type ActivityAction =
  | 'auth.sign_in'
  | 'profile.updated'
  | 'password.changed'
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'organization.restored'
  | 'organization.purged'
  | 'email_account.connected'
  | 'email_account.disconnected'
  | 'mail.sent'
  | 'mail.replied'
  | 'mail.forwarded'
  | 'mail.deleted'

/** One recorded action a user took; rows are immutable. */
export interface ActivityLog {
  id: string
  created_at: ISO8601DateString
  /** The actor, null when no signed-in caller finished the action. */
  user_id: string | null
  organization_id?: string | null
  action: ActivityAction
  description: string
  /** The action's details; its shape follows from the action. */
  metadata?: Record<string, unknown> | null
  /** Where a sign-in came from. */
  ip?: string
  /** Joined from the users mirror; empty when the actor is unknown. */
  actor_name?: string
  actor_email?: string
}
