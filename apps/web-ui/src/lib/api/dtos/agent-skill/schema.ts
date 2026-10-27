import z from 'zod'

import { requiredString } from '@/lib/validation'

// The limits match the server's AgentSkillBody (apps/server internal/dtos/agent_skill.go).
const tooLong = (attribute: string, max: number) =>
  `The ${attribute} may not be greater than ${max} characters.`

export const AgentSkillFormSchema = z.object({
  name: requiredString('name').max(100, tooLong('name', 100)),
  description: z.string().trim().max(300, tooLong('description', 300)),
  instruction: requiredString('instruction').max(5000, tooLong('instruction', 5000)),
  /** '' runs it as the bot the user picked. */
  agent_bot_id: z.string(),
  is_enabled: z.boolean(),
})

export type AgentSkillFormDto = z.infer<typeof AgentSkillFormSchema>

/** A built-in skill's settings. */
export type BuiltinSkillDto = { is_enabled: boolean; agent_bot_id: string }
