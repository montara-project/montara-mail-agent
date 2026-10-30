import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import browserCollections from 'collections/browser'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page'

import { getMDXComponents } from '@/components/mdx'
import { baseOptions } from '@/lib/layout.shared'
import { appName, getPageImageUrl, getPageMarkdownUrl, gitConfig, siteUrl } from '@/lib/shared'
import { source } from '@/lib/source'

// Pages sit at the root (docsRoute is '/'), so the splat route serves them all, / included.
export const Route = createFileRoute('/$')({
  component: Page,
  loader: async ({ params }) => {
    const data = await loadPage({ data: params._splat?.split('/').filter(Boolean) ?? [] })
    await clientLoader.preload(data.path)
    return data
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.title} | ${appName} Docs` },
            { name: 'description', content: loaderData.description },
            { property: 'og:title', content: loaderData.title },
            { property: 'og:description', content: loaderData.description },
            { property: 'og:image', content: siteUrl + loaderData.imageUrl },
          ],
        }
      : {},
})

// The page tree and the page's metadata come from the server; the MDX body
// loads on its own through the browser collection.
const loadPage = createServerFn({ method: 'GET' })
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs)
    if (!page) throw notFound()

    return {
      path: page.path,
      title: page.data.title,
      description: page.data.description ?? '',
      markdownUrl: getPageMarkdownUrl(page).url,
      imageUrl: getPageImageUrl(page).url,
      pageTree: await source.serializePageTree(source.getPageTree()),
    }
  })

const clientLoader = browserCollections.docs.createClientLoader({
  component(
    { toc, frontmatter, default: MDX },
    { path, markdownUrl }: { path: string; markdownUrl: string }
  ) {
    return (
      <DocsPage toc={toc} full={frontmatter.full}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription className="mb-0">{frontmatter.description}</DocsDescription>
        <div className="flex flex-row items-center gap-2 border-b pb-6">
          <MarkdownCopyButton markdownUrl={markdownUrl} />
          <ViewOptionsPopover
            markdownUrl={markdownUrl}
            githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/${gitConfig.contentDir}/${path}`}
          />
        </div>
        <DocsBody>
          <MDX components={getMDXComponents()} />
        </DocsBody>
      </DocsPage>
    )
  },
})

function Page() {
  const { pageTree, path, markdownUrl } = useFumadocsLoader(Route.useLoaderData())

  return (
    <DocsLayout tree={pageTree} {...baseOptions()}>
      {clientLoader.useContent(path, { path, markdownUrl })}
    </DocsLayout>
  )
}
