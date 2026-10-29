import { createGetUrl } from 'fumadocs-core/source'

export const appName = 'Montara Mail'
export const siteUrl = 'https://docs.montaramail.web.id'
// The docs are the whole site, so pages sit at the root: /self-hosting, not /docs/self-hosting.
export const docsRoute = '/'
export const docsImageRoute = '/og'
export const docsContentRoute = '/llms.mdx'

export const gitConfig = {
  user: 'montara-project',
  repo: 'montara-mail-agent',
  branch: 'main',
  // Where content/docs lives in the monorepo, for the "Edit on GitHub" link.
  contentDir: 'apps/docs/content/docs',
}

const getContentUrl = createGetUrl(docsContentRoute)

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md']

  return { segments, url: getContentUrl(segments, page.locale) }
}

const getImageUrl = createGetUrl(docsImageRoute)

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png']

  return { segments, url: getImageUrl(segments, page.locale) }
}
