# Web UI

Frontend generated from [masb0ymas/vine](https://github.com/masb0ymas/vine) (`vite`).

## Scripts

- `pnpm --filter web-ui dev` starts the dev server (proxies `/api` to the backend on :8080).
- `pnpm --filter web-ui build` builds production output.
- `pnpm --filter web-ui preview` serves the built SPA locally.
- `pnpm --filter web-ui generate-routes` regenerates `src/routeTree.gen.ts`.

Environment variables are documented in `.env.example`.
