import { metaSchema, pageSchema } from 'fumadocs-core/source/schema'
import { defineConfig, defineDocs } from 'fumadocs-mdx/config'

// Pages and meta.json under content/docs; .source/ is generated from this.
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    // The raw Markdown that llms.txt and the "Copy Markdown" button serve.
    postprocess: { includeProcessedMarkdown: true },
  },
  meta: { schema: metaSchema },
})

export default defineConfig()
