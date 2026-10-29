-- Addresses the API refuses before any route runs: blocked by a super user
-- (source manual) or by the server itself after repeated failed sign-ins or
-- rate-limit hits (source auto). "network" holds one address (/32, /128) or
-- a range. expires_at NULL blocks until someone removes it. One row per
-- network: a manual block replaces an automatic one, never the reverse.
CREATE TABLE IF NOT EXISTS "ip_blocks" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "network" CIDR NOT NULL,
  "source" VARCHAR NOT NULL,
  "reason" VARCHAR NOT NULL DEFAULT '',
  "expires_at" TIMESTAMPTZ,
  "created_by" UUID REFERENCES "users" ("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ip_blocks_network ON "ip_blocks" ("network");
