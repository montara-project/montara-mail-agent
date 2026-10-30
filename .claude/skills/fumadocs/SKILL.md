---
name: fumadocs
description: Work on the Fumadocs docs site in apps/docs (TanStack Start + Fumadocs MDX on Cloudflare Workers). Use when writing or editing docs content under content/docs, changing sidebar/navigation via meta.json, or touching docs wiring (source.config.ts, src/lib/source.ts, the splat page route, MDX components, vite/cloudflare config).
---

# Fumadocs

Docs site lives in `apps/docs`, deployed to docs.montaramail.web.id. Content source is Fumadocs MDX (Config API); routing by TanStack Start (file routes under `src/routes`), every page prerendered at build time, and the whole app deployed as a Cloudflare Worker (`cloudflare.config.ts`, Cloudflare Vite plugin, `cf deploy`).

## Pick a branch

- **Writing or editing docs content** (new page, frontmatter, sidebar order, MDX components) → read [CONTENT.md](CONTENT.md) and follow it.
- **Changing docs wiring** (collections/schema, loader, routes, MDX setup, theming, Worker config) → read [APP.md](APP.md) and follow it.

Wrong branch wastes the whole change: content edits never touch `src/` wiring; wiring changes never hand-write slugs or sidebar trees.

## Rules for both

1. **Follow the existing wiring, don't re-derive it.** `apps/docs/source.config.ts`, `apps/docs/src/lib/source.ts`, `apps/docs/src/routes/$.tsx` and `apps/docs/vite.config.ts` are the source of truth. Pages are served at the site root (`docsRoute = '/'`), never under `/docs`. Match their patterns; don't introduce a second convention (e.g. macro API alongside the Config API).
2. **Slugs and sidebar are generated, never hardcoded.** File paths under `apps/docs/content/docs` plus `meta.json` produce slugs and the page tree via `loader()`. No manual route lists.
3. **Title comes from frontmatter, not `# h1`.** Every doc file needs `title` in frontmatter; body starts at `##`.
4. **Check current docs before writing route or config code.** TanStack Start, the Cloudflare Vite plugin and `cf/config` all move fast; read the installed types (`node_modules/@tanstack/start-plugin-core/dist/esm/schema.d.ts`, `@cloudflare/config`) or current docs instead of relying on memory.
5. **Verify by running.** Content: `pnpm --filter @montara-mail/docs dev` (port 3001) and open the page. Wiring: also run `typecheck` (`tsc --noEmit`) and `build` (prerender fails on a broken page or link) in `apps/docs`. Generated `.source/` and `src/routeTree.gen.ts` are build artifacts, never edited by hand.
