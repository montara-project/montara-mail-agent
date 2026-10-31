# Main Web

Marketing site for Montara Mail: home, integrations, self-hosted, contact, privacy, and terms. Generated from [masb0ymas/vine](https://github.com/masb0ymas/vine) (`vinext-cf`).

## Scripts

- `pnpm --filter @montara-mail/main-web dev` starts the dev server.
- `pnpm --filter @montara-mail/main-web build` builds production output.
- `pnpm --filter @montara-mail/main-web start` previews the built Worker locally.
- `pnpm --filter @montara-mail/main-web run deploy` deploys to Cloudflare Workers (`cf auth login` or `CLOUDFLARE_API_TOKEN`).
