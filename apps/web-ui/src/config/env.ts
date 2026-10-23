import { z } from 'zod'

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

// The server a browser uses until it picks its own (see server-url.ts). Empty
// means the hosted Montara server, or in development this origin, which
// proxies /api to the local API.
export const env = {
  ...parsed,
  VITE_API_URL:
    parsed.VITE_API_URL ||
    (import.meta.env.DEV ? window.location.origin : 'https://app.montaramail.web.id'),
}
