import { defineConfig, defineWorker } from 'cf/config'

// The TanStack Start server runs as the Worker. Prerendered pages and the
// client build are its static assets, served before the Worker runs; the
// Worker renders the rest (Markdown copies, OG images, the 404 page).
export default defineConfig({
  worker: defineWorker({
    name: 'montaramail-docs',
    entrypoint: '@tanstack/react-start/server-entry',
    compatibilityDate: '2026-10-22',
    compatibilityFlags: ['nodejs_compat'],
    assets: {
      // /self-hosting serves self-hosting.html.
      htmlHandling: 'auto-trailing-slash',
      notFoundHandling: 'none',
    },
    observability: { enabled: true },
    domains: ['docs.montaramail.web.id'],
  }),
})
