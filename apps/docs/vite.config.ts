import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  server: { port: 3001 },
  preview: { port: 3001 },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      // Every page is built to static HTML; a broken page fails the build.
      prerender: { enabled: true, crawlLinks: true, autoSubfolderIndex: false, failOnError: true },
      // Not linked from any page, so the crawler would miss them.
      pages: [{ path: '/api/search' }, { path: '/llms.txt' }, { path: '/llms-full.txt' }],
    }),
    react(),
  ],
  resolve: { tsconfigPaths: true },
})
