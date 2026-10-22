import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  /*
   * Client-side environment variables. vinext inlines NEXT_PUBLIC_* into the
   * browser bundle, but only for literal `process.env.NAME` reads, hence the
   * explicit runtimeEnv below.
   */
  clientPrefix: 'NEXT_PUBLIC_',
  client: {
    // Empty = same origin; next.config.ts rewrites /api to API_PROXY_TARGET.
    NEXT_PUBLIC_API_URL: z.url().optional(),
    NEXT_PUBLIC_APP_NAME: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
  emptyStringAsUndefined: true,
})
