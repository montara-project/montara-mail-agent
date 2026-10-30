# Docs App Wiring

For collections, loader, routes, MDX setup and the Worker in `apps/docs`. Content edits (pages, `meta.json`) are out of scope → [CONTENT.md](CONTENT.md).

## Map

| File                                   | Role                                                              |
| -------------------------------------- | ----------------------------------------------------------------- |
| `source.config.ts`                     | Collection definitions (`defineDocs`, `dir: 'content/docs'`)      |
| `src/lib/source.ts`                    | `loader({ baseUrl: docsRoute, source: docs.toFumadocsSource() })` (`docs` from `collections/server`), plus `docsLlms` |
| `src/lib/shared.ts`                    | `docsRoute = '/'` (pages at the root), app name, site URL, GitHub repo for edit links, Markdown and OG image URLs |
| `src/lib/layout.shared.tsx`            | `baseOptions()` for `DocsLayout` / `HomeLayout`                   |
| `src/routes/__root.tsx`                | HTML shell, `<head>` (title, favicons, CSS), `RootProvider` from `fumadocs-ui/provider/tanstack` with the static search dialog |
| `src/routes/$.tsx`                     | Every docs page, `/` included: a server function returns the page tree and metadata, `browserCollections.docs.createClientLoader` renders the MDX body; `head()` sets title, description, OG tags |
| `src/routes/api/search.ts`             | Static search index (`staticGET`), read by `src/components/search.tsx` |
| `src/routes/llms[.]txt.ts`, `llms-full[.]txt.ts`, `llms[.]mdx/$.ts` | Markdown for LLMs; `/llms.mdx/<slugs>/content.md` backs "Copy Markdown" |
| `src/routes/og/$.ts`                   | `/og/<slugs>/image.png`, rendered by the Worker with `fumadocs-ui/og/takumi` (WASM) |
| `src/router.tsx`                       | `getRouter()`; `NotFound` (`src/components/not-found.tsx`) is the 404 page |
| `src/components/mdx.tsx`               | `getMDXComponents()` (currently bare `defaultMdxComponents`)      |
| `src/styles/app.css`                   | Tailwind, Fumadocs UI CSS (`neutral`, `preset`), Plus Jakarta Sans |
| `vite.config.ts`                       | Cloudflare Vite plugin (`ssr` env), `fumadocsMdx()`, Tailwind, `tanstackStart({ prerender })`, React |
| `cloudflare.config.ts`                 | The Worker: `entrypoint: '@tanstack/react-start/server-entry'`, assets handling, custom domain |
| `public/_headers`                      | Security headers for static asset responses (all prerendered pages) |

`source.config.ts` uses the Config API (entry files generated under `.source/`: `server.ts` for the loader, `browser.ts` for the MDX bodies). Do NOT mix in the macro API (`fumadocs-mdx/macro`) or hand-edit `.source/`. See [MDX](https://www.fumadocs.dev/docs/mdx), [TanStack Start setup](https://www.fumadocs.dev/docs/manual-installation/tanstack-start).

## Operations

**Extend frontmatter / folder fields.** Edit `source.config.ts` schema:

```ts
import { pageSchema, metaSchema } from 'fumadocs-core/source/schema'

export const docs = defineDocs({
  docs: { schema: pageSchema.extend({ index: z.boolean().default(false) }) },
  meta: { schema: metaSchema.extend({ /* extra props */ }) },
})
```

Validation runs at build time; output MUST be serializable. See [collections](https://www.fumadocs.dev/docs/mdx/collections).

**Change loader behaviour.** Edit `src/lib/source.ts` only: `baseUrl`/`url()`, custom `slugs()`, `icon()` handler (map name → JSX, e.g. via `lucide-react`), `i18n` config. API: [loader](https://www.fumadocs.dev/docs/headless/source-api).

**Change docs chrome.** Edit `src/routes/$.tsx` (`DocsLayout`) and `src/lib/layout.shared.tsx` (`nav`, `links`, `sidebar`, `tabs`). Sidebar items render from the page tree. See [docs layout](https://www.fumadocs.dev/docs/ui/layouts/docs).

**Change page rendering.** Edit the client loader component in `src/routes/$.tsx` (`DocsPage`/`DocsTitle`/`DocsDescription`/`DocsBody`) and `src/components/mdx.tsx`. The server function only returns serializable data; anything that needs `source` stays inside it, because `source` imports every page eagerly and must not reach the client bundle. See [components](https://www.fumadocs.dev/docs/ui/components).

**Add a non-page route** (a file, an API). Use a server route (`createFileRoute(path)({ server: { handlers: { GET } } })`). If nothing links to it and it should be static, add it to `pages` in `vite.config.ts`; otherwise the Worker serves it at request time.

## Guardrails

- Node.js ≥ 22.18 (`cloudflare.config.ts` loading). `postinstall` runs `fumadocs-mdx` (typegen); `typecheck` is `tsc --noEmit` and needs the committed `src/routeTree.gen.ts`.
- `@tanstack/react-router` must match the version `@tanstack/react-start` depends on; two copies of `router-core` drop the `server` route option from the types.
- Prerender writes `<slug>.html` (`autoSubfolderIndex: false`) and assets use `auto-trailing-slash`, so `/self-hosting` serves `self-hosting.html`. A crawled link that 404s fails the build.
- The Worker bundle (takumi WASM included) is ~2.3 MB gzip; Workers Free caps it at 3 MB. Check with `cf deploy --prebuilt --dry-run` after adding server-side dependencies.
- No docs page may live at `content/docs/api/search.mdx`, `llms.mdx/` or `og/`: those paths are routes.
- `pnpm --filter @montara-mail/docs build` writes `.cloudflare/output`; the Release workflow deploys it with `cf deploy --prebuilt`.

## Checklist

1. Change confined to the owning file in the map above; no parallel convention introduced.
2. `pnpm --filter @montara-mail/docs typecheck` and `build` pass.
3. `pnpm --filter @montara-mail/docs dev`, open `http://localhost:3001/`; layout, page, and sidebar render.
