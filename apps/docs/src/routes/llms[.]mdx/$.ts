import { createFileRoute } from '@tanstack/react-router'

import { docsLlms, source } from '@/lib/source'

// /llms.mdx/<slugs>/content.md: a page's Markdown, for "Copy Markdown" and LLMs.
export const Route = createFileRoute('/llms.mdx/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        // remove the appended "content.md"
        const page = source.getPage(params._splat?.split('/').filter(Boolean).slice(0, -1))
        if (!page) return new Response('Not found', { status: 404 })

        return new Response(await docsLlms.page(page), {
          headers: { 'Content-Type': 'text/markdown' },
        })
      },
    },
  },
})
