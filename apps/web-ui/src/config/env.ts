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

// The server a browser uses until it picks its own (see server-url.ts). Empty
// means the hosted Montara server, or in development this origin, which
// proxies /api to the local API.
export const env = {
  ...parsed,
  VITE_API_URL:
    parsed.VITE_API_URL ||
    (import.meta.env.DEV ? window.location.origin : 'https://app.montaramail.web.id'),
}
