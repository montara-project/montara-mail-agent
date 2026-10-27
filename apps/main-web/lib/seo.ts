import type { Metadata } from 'next'

export const SITE_URL = 'https://montaramail.web.id'
export const SITE_NAME = 'Montara Mail'

/**
 * A page's own canonical and social card. A page's `openGraph` replaces the
 * layout's whole object rather than merging into it, so every page builds the
 * full card here; the image comes from app/opengraph-image.png.
 */
export function pageMetadata({
  path,
  title,
  description,
}: {
  path: string
  /** Without the site name; the layout's template adds it. Omit for the home page. */
  title?: string
  description: string
}): Metadata {
  const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME}: AI email management`
  return {
    ...(title && { title }),
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE_NAME, url: path, title: fullTitle, description },
  }
}
