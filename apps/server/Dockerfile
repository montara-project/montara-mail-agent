# syntax=docker/dockerfile:1

# Single-image deployment: the web app (apps/app) is compiled with pnpm, then
# placed next to the Go binary, so one process on port 8080 serves both the
# API under /api and the UI.
#
# Build context: repository root
#   docker build -f apps/server/Dockerfile -t montara-mail/cloud .
#   docker build -f apps/server/Dockerfile --build-arg EDITION=community -t montara-mail/community .
#
# EDITION picks the edition for both the web app and the binary: cloud
# (Cloud Edition, the default) or community (Community Edition: one self-hosted
# user, no sign-up and no sharing).
ARG EDITION=cloud

# ====================================================================================
# Stage 1: web-ui (Vite build -> static dist)
# ====================================================================================
FROM node:24-alpine AS web-ui

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH

WORKDIR /build

# The workspace manifest and lockfile must be present before install so pnpm
# resolves the frozen workspace graph.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/app/package.json apps/app/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    corepack enable && pnpm install --frozen-lockfile --filter @montara-mail/app...

COPY apps/app apps/app

# Vite inlines VITE_* into the bundle at build time: .env is docker-ignored and
# runtime env vars can't reach the static dist. An empty VITE_API_URL means the
# page's own origin (UI and API share one); mail --build-arg VITE_API_URL=...
# only when the API lives on a different origin.
ARG VITE_APP_NAME="Montara Mail"
ARG VITE_API_URL=""
ARG EDITION
ENV VITE_APP_NAME=$VITE_APP_NAME \
    VITE_API_URL=$VITE_API_URL \
    VITE_EDITION=$EDITION

# `exec` bypasses the package.json lifecycle: image builds only bundle; lint,
# format and type checks belong to CI and development.
RUN pnpm --filter @montara-mail/web-ui exec vite build

# ====================================================================================
# Stage 2: server (Go build)
# ====================================================================================
FROM golang:1.27-alpine AS server

WORKDIR /build

COPY apps/server/go.mod apps/server/go.sum ./

RUN --mount=type=cache,id=go-mod,target=/go/pkg/mod go mod download

COPY apps/server ./

# APP_VERSION is baked into the binary and reported by /api/health; the release
# workflow passes the git tag (e.g. v1.2.3).
ARG APP_VERSION=dev
ARG EDITION

# The migrations are embedded in both binaries, so no SQL files ship separately.
RUN --mount=type=cache,id=go-mod,target=/go/pkg/mod \
    --mount=type=cache,id=go-build,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath \
    -ldflags="-s -w -X montara-mail/server/internal/app.Version=${APP_VERSION} -X montara-mail/server/internal/config.Edition=${EDITION}" \
    -o /build/out/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath \
    -ldflags="-s -w -X montara-mail/server/internal/config.Edition=${EDITION}" \
    -o /build/out/migrate ./cmd/migrate

# ====================================================================================
# Stage 3: runtime (server + web app static files in ./public)
# ====================================================================================
FROM alpine:3.22

# ca-certificates: outbound calls to Resend, Google and Sentry are HTTPS.
# tzdata: timestamps in logs follow the configured timezone.
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S montara && adduser -S montara -G montara

WORKDIR /app

COPY --from=server /build/out/api ./api
COPY --from=server /build/out/migrate ./migrate
# The API serves the web app from ./public, relative to this directory.
COPY --from=web-ui /build/apps/app/dist ./public

# cmd/api reads these as its flag defaults. They are environment variables
# rather than CMD flags on purpose: a flag would silently beat a runtime
# `-e PORT=...`. DB_DSN and APP_SECRET must be supplied at runtime.
ENV ENV=production \
    PORT=8080

USER montara

EXPOSE 8080

ENTRYPOINT ["./api"]