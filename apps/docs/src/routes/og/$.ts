import { createFileRoute } from '@tanstack/react-router'
import { generateOGImage } from 'fumadocs-ui/og/takumi'

import { appName } from '@/lib/shared'
import { source } from '@/lib/source'

// /og/<slugs>/image.png: a page's Open Graph image, rendered by the Worker.
export const Route = createFileRoute('/og/$')({
  server: {
    handlers: {
      GET: ({ params }) => {
        // remove the appended "image.png"
        const page = source.getPage(params._splat?.split('/').filter(Boolean).slice(0, -1))
        if (!page) return new Response('Not found', { status: 404 })

        return generateOGImage({
          title: page.data.title,
          description: page.data.description,
          site: appName,
        })
      },
    },
  },
})
