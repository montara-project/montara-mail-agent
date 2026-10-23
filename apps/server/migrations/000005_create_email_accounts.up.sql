-- A mailbox connected over IMAP. The password is sealed with the app secret
-- (see lib.SecretBox) and never leaves the server.
CREATE TABLE IF NOT EXISTS "email_accounts" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "organization_id" UUID NOT NULL REFERENCES "organizations" ("id"),
  "provider" VARCHAR NOT NULL,
  "label" VARCHAR NOT NULL,
  "email" VARCHAR NOT NULL,
  "imap_host" VARCHAR NOT NULL,
  "imap_port" INTEGER NOT NULL,
  "username" VARCHAR NOT NULL,
  "password" BYTEA NOT NULL,
  "synced_at" TIMESTAMPTZ,
  "sync_error" TEXT,
  UNIQUE ("organization_id", "email")
);
