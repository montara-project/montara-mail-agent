# Montara Mail Agent

An AI mail client for teams. Connect Gmail, Outlook, Yahoo, iCloud, Lark, Zoho
or any IMAP mailbox to an organization, and Montara syncs it, sorts new inbox
mail into `important` or `low_priority`, summarizes mail and suggests replies.
You can read, send, reply and forward from the same place.

The hosted app runs at <https://app.montaramail.web.id>. You can also run it
yourself: the API and the web app ship as a single Docker image.

## What's inside

A pnpm workspace with four apps:

| App                              | What it is                                                                                         | Stack                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`apps/server`](apps/server)     | The API: auth, organizations, IMAP sync, SMTP send, AI features, activity log. Also serves the web app in production. | Go 1.27, Fiber v3, PostgreSQL 18, [Authula](https://github.com/Authula/authula), golang-migrate |
| [`apps/web-ui`](apps/web-ui)     | The mail client (SPA).                                                                             | React, Vite, TanStack Router/Query/Form, Tailwind, Lexical  |
| [`apps/main-web`](apps/main-web) | The marketing site: home, contact, privacy, terms.                                                 | vinext on Cloudflare Workers                                |
| [`apps/docs`](apps/docs)         | The docs at <https://docs.montaramail.web.id>: using, self-hosting, the API, development.          | TanStack Start + Fumadocs, prerendered, on Cloudflare Workers |

[`apps/server/README.md`](apps/server/README.md) covers the API in depth:
every environment variable, the routes, authentication, idempotent writes
and the integration test.

## Features

- **Mailboxes**: connect with an app password, or with OAuth for Google,
  Microsoft, Yahoo and Zoho. IMAP and SMTP servers are built in for the known
  providers. Passwords and tokens are encrypted in the database with a key
  derived from `APP_SECRET`.
- **Sync**: a background job syncs every mailbox (every 5 minutes by
  default). Read, starred, move and delete are written back to the mail
  server.
- **AI**: classification, summaries and reply suggestions. Each organization
  picks its own model (any OpenAI- or Anthropic-compatible endpoint, or a
  self-hosted one such as Ollama). `ANTHROPIC_API_KEY` is the fallback for
  organizations that haven't set one.
- **Compose**: send, reply (threaded) and forward over the account's SMTP
  server, with attachments. HTML mail renders in a sandboxed frame.
- **Accounts**: email & password, magic link and Google sign-in, two-factor
  (TOTP) with backup codes, and an activity log.
- **Organizations**: members share an organization's mailboxes. A super user
  manages every organization.

## Editions

The edition is chosen at build time (`EDITION` build arg, which sets
`config.Edition` in Go and `VITE_EDITION` in the web app):

| Edition           | For                    | Notes                                                                                     |
| ----------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| `cloud` (default) | The hosted service     | Open sign-up. Needs Resend (`FROM_ADDRESS`, `RESEND_API_KEY`) for verification emails.     |
| `community`       | A single self-hosted user | No sign-up. The only account is `SUPER_USER`, so it needs `SEED_ON_BOOT=true`. The web app talks to its own origin until you pick another server under Self hosted, which only this edition has. No plans, billing, purchases or AI quota. |

## Development

Requirements: Node.js 24, pnpm 11 (`corepack enable`), Go 1.27.2+ and
PostgreSQL 18 (the migrations use `uuidv7()`).

```sh
pnpm install

cp apps/server/.env.example apps/server/.env   # fill in APP_SECRET (openssl rand -base64 32)
cp apps/web-ui/.env.example apps/web-ui/.env

pnpm dev            # every app in parallel
pnpm dev:server     # API on :8080 (make run, reads apps/server/.env)
pnpm dev:web-ui     # web app on :3000, proxies /api to :8080
pnpm dev:main-web   # marketing site
pnpm dev:docs       # docs on :3001
```

With `MIGRATE_ON_BOOT=true` (the example default) the API applies its
migrations when it starts. To manage the database by hand, use the Makefile
in `apps/server`:

```sh
make db/migrations/up          # apply migrations
make db/migrations/up/seed     # ... and seed the default organization
make db/migrations/refresh     # roll back and reapply (localhost only, deletes all data)
```

### Checks

```sh
pnpm lint           # oxlint
pnpm format:check   # oxfmt
pnpm typecheck      # tsc --noEmit in every TS app
pnpm --filter @montara-mail/server test   # go test ./...
```

`apps/server/cmd/api` also has an integration test that runs against
PostgreSQL when `TEST_DB_DSN` is set (see the server README).

Commits follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat(web-ui): ...`, `fix(server): ...`). Husky and commitlint enforce the
format, and the release changelog is generated from it.

## Self-hosting with Docker

The image is built from the repository root. It holds the API, the built web
app (served at `/`, with `/api` and `/health` kept for the API), `migrate`
and `healthcheck`, on a distroless, non-root base.

```sh
docker build -f apps/server/Dockerfile --build-arg EDITION=community -t montara-mail-agent/community .
```

`apps/server/docker-compose.yml` runs PostgreSQL 18, a one-shot migration and
the API on port 8080, with secrets read from `apps/server/.env`:

```sh
cd apps/server
docker compose up -d --build
```

The images published by the release workflow can be used instead:

```text
ghcr.io/montara-project/montara-mail-agent/cloud
ghcr.io/montara-project/montara-mail-agent/community
```

`DB_DSN` and `APP_SECRET` are required at runtime. Set `AUTH_BASE_URL` to the
public URL (email links and OAuth callbacks use it) and `TRUSTED_PROXIES` when
the API sits behind a reverse proxy. Rotating `APP_SECRET` means reconnecting
every mailbox and saving the LLM providers again.

To point a Community Edition web app at another server, serve that API over
HTTPS, add the web app's origin to its `CORS_ALLOWED_ORIGINS` and pick the
server under Control Center > Organization > Self hosted. The hosted web app
always uses the hosted server.

## Releases

Releases are cut from `main` with [release-it](https://github.com/release-it/release-it)
in GitHub Actions:

1. **Release Prepare** (`release-prepare.yml`, run by hand) bumps the version,
   updates `CHANGELOG.md` from the conventional commits and opens a
   `chore: release vX.Y.Z` pull request.
2. **Release Publish** (`release-publish.yml`) runs when that PR merges: it
   tags the merge commit, creates the GitHub release and dispatches the release
   workflow.
3. **Release** (`release.yml`) builds and pushes both edition images to GHCR
   (`vX.Y.Z`, `vX.Y`, `latest`), and deploys `apps/main-web` and `apps/docs`
   to Cloudflare Workers.

`security-audit.yml` runs govulncheck and `pnpm audit` on every push to
`main`/`dev`, on pull requests and weekly. `react-doctor.yml` reviews React
changes on pull requests. Known findings are tracked in [`ISSUES.md`](ISSUES.md).

## License

[GPL-3.0](LICENSE.md)
