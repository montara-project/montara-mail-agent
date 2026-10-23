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
