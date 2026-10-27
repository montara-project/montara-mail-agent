import type { Models } from '@/lib/api/models'

/**
 * The select value for "no bot of its own": the skill then runs as the bot
 * the user picked. Radix Select reserves the empty string, so it stands in
 * for the API's ''.
 */
export const PICKED_BOT = 'picked'

/** A skill's bot choices: the user's pick first, then the organization's bots. */
export const botOptions = (bots: Models.AgentBot[]) => [
  { value: PICKED_BOT, label: 'Bot picked by the user' },
  ...bots.map((bot) => ({ value: bot.id, label: bot.name })),
]

export const toBotSelect = (id: string | null) => id ?? PICKED_BOT
export const fromBotSelect = (value: string) => (value === PICKED_BOT ? '' : value)
