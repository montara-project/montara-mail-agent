# syntax=docker/dockerfile:1
# Backend + SPA in one image: the API serves the built single-page app at /
# (SPA_DIR) and keeps /api and /health for itself. One origin, so the browser
# needs no CORS and the session cookie stays first-party.
#
# Build from the workspace root:  docker build -f apps/server/Dockerfile .

# ---- SPA (apps/web-ui): built once on the builder's platform; the output is plain files.
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /repo
RUN corepack enable
COPY . .
# `web-ui...` installs the app and the workspace packages it depends on.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter web-ui...
# The SPA calls the API with relative URLs (/api/v1/...): same origin, nothing
# to bake in. Declare VITE_* build args here if the app needs any.
RUN pnpm --filter web-ui build && test -f apps/web-ui/dist/index.html

# ---- API
FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS build
WORKDIR /src

COPY apps/server/go.mod apps/server/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY apps/server/ .
ARG TARGETOS TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags="-s -w" -o /out/ ./cmd/api ./cmd/migrate ./cmd/healthcheck

# ---- Runtime: static, no shell, nonroot.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app

COPY --from=build /out/api /out/migrate /out/healthcheck ./
COPY apps/server/public ./public
COPY --from=web /repo/apps/web-ui/dist ./web

ENV SPA_DIR=/app/web
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 CMD ["/app/healthcheck"]
ENTRYPOINT ["/app/api"]
