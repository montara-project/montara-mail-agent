import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/contact', '/privacy', '/terms'].map((path) => ({
    url: `${SITE_URL}${path === '/' ? '' : path}`,
  }))
}
