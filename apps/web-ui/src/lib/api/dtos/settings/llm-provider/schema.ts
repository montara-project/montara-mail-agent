import z from 'zod'

import { requiredEnum, requiredString } from '@/lib/validation'

export const LLM_PROVIDER_KINDS = ['openai', 'anthropic'] as const

export const LLMProviderFormSchema = z.object({
  kind: requiredEnum(LLM_PROVIDER_KINDS, 'provider'),
  base_url: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^https?:\/\/\S+$/.test(value),
      'The base URL must start with https://.'
    ),
  model: requiredString('model'),
  // Empty keeps the saved key.
  api_key: z.string().trim(),
})

export type LLMProviderFormDto = z.infer<typeof LLMProviderFormSchema>

/** A model on the user's own server: OpenAI format, the base URL required, the key optional. */
export const SelfHostedFormSchema = z.object({
  kind: z.literal('self_hosted'),
  base_url: z
    .string()
    .trim()
    .regex(/^https?:\/\/\S+$/, 'The base URL must start with http:// or https://.'),
  model: requiredString('model'),
  api_key: z.string().trim(),
})

export type SelfHostedFormDto = z.infer<typeof SelfHostedFormSchema>
