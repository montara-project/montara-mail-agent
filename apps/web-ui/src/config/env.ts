import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

const parsed = createEnv({
  /*
   * Client-side environment variables. This app is a Vite SPA, there is no
   * server bundle here. Vite only inlines vars prefixed with VITE_ into the
   * client build.
   */
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: z.url().optional(),
    VITE_APP_NAME: z.string().optional(),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
})

// An empty VITE_API_URL means "same as the page origin" (dev proxies /api);
// set it only for a split-origin setup.
export const env = {
  ...parsed,
  VITE_API_URL: parsed.VITE_API_URL || window.location.origin,
}
