import type { Models } from '../models'

type PersonaFields = Pick<
  Models.AgentBot,
  'name' | 'description' | 'soul' | 'memory' | 'style' | 'instruction'
>

/**
 * The persona block that opens every prompt a bot steers, for the form's live
 * preview. Mirrors AgentBot.Persona() in apps/server internal/models/agent_bot.go:
 * keep both in sync, or the preview stops being what the model gets.
 */
export function composePersona(bot: PersonaFields): string {
  let out = `You are ${bot.name}, an AI assistant working on the mailbox owner's behalf`
  if (bot.description !== '') out += `: ${bot.description}`
  out += '.'
  const sections: [string, string][] = [
    ['SOUL', bot.soul],
    ['MEMORY', bot.memory],
    ['STYLE', bot.style],
    ['INSTRUCTIONS', bot.instruction],
  ]
  for (const [title, body] of sections) {
    if (body.trim() === '') continue
    out += `\n\n${title}:\n${body.trim()}`
  }
  return out
}
