import z from 'zod'

import { requiredString } from '@/lib/validation'

// The limits match the server's AgentBotBody (apps/server internal/dtos/agent_bot.go).
const tooLong = (attribute: string, max: number) =>
  `The ${attribute} may not be greater than ${max} characters.`

// Optional text stays a plain string: the form holds an empty input as "".
const optionalText = (attribute: string, max: number) =>
  z.string().trim().max(max, tooLong(attribute, max))

export const AgentBotFormSchema = z.object({
  name: requiredString('name').max(100, tooLong('name', 100)),
  description: optionalText('description', 300),
  soul: optionalText('soul', 5000),
  memory: optionalText('memory', 5000),
  style: optionalText('style', 5000),
  instruction: optionalText('instruction', 5000),
  is_default: z.boolean(),
})

export type AgentBotFormDto = z.infer<typeof AgentBotFormSchema>
