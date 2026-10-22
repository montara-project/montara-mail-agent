# Main Web

Frontend generated from [masb0ymas/vine](https://github.com/masb0ymas/vine) (`vinext-cf`).

## Scripts

- `pnpm --filter main-web dev` starts the dev server (proxies `/api` to the backend on :8080).
- `pnpm --filter main-web build` builds production output.
- `pnpm --filter main-web start` previews the built Worker locally.
- `pnpm --filter main-web run deploy` deploys to Cloudflare Workers (`cf auth login` or `CLOUDFLARE_API_TOKEN`).

Environment variables are documented in `.env.example`.
