import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '/',
    '/pricing',
    '/integrations',
    '/self-hosted',
    '/contact',
    '/changelog',
    '/privacy',
    '/terms',
  ].map((path) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
  }))
}
