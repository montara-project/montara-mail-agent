import { createFileRoute } from '@tanstack/react-router'
import { createFromSource } from 'fumadocs-core/search/server'

import { source } from '@/lib/source'

const server = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: 'english',
})

// The whole index in one file, prerendered; components/search.tsx searches it in the browser.
export const Route = createFileRoute('/api/search')({
  server: { handlers: { GET: () => server.staticGET() } },
})
