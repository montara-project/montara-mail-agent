import { z } from 'zod'

import { COMMUNITY } from '@/lib/constants/edition'

// Vite only inlines vars prefixed with VITE_ into the client build.
const parsed = z
  .object({
    VITE_API_URL: z.url().optional(),
    VITE_APP_NAME: z.string().optional(),
  })
  // An empty value means unset.
  .parse({
    VITE_API_URL: import.meta.env.VITE_API_URL || undefined,
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME || undefined,
  })

// The server a browser uses, unless the Community Edition picks another (see
// server-url.ts). Empty means the hosted Montara server, or in development and in the Community
// Edition this origin: dev proxies /api to the local API, and the Community
// server serves this app itself.
export const env = {
  ...parsed,
  VITE_API_URL:
    parsed.VITE_API_URL ||
    (import.meta.env.DEV || COMMUNITY ? window.location.origin : 'https://app.montaramail.web.id'),
}
