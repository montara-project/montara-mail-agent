-- The MCP servers an organization's agent may call tools on: a remote
-- endpoint reached with headers (http) or an OAuth token (hosted), or a local
-- command over stdio (command, which only a super user may add). Header and
-- environment values and the OAuth client and token are sealed with the app
-- secret (see lib.SecretBox) in "secrets". "tools" is the last list synced
-- from the server, which the agent offers the model.
CREATE TABLE IF NOT EXISTS "mcp_servers" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "organization_id" UUID NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "name" VARCHAR NOT NULL,
  "kind" VARCHAR NOT NULL,
  "url" VARCHAR NOT NULL DEFAULT '',
  "command" VARCHAR NOT NULL DEFAULT '',
  "args" JSONB NOT NULL DEFAULT '[]',
  "secrets" BYTEA,
  "tools" JSONB NOT NULL DEFAULT '[]',
  -- pending (never synced), connected, needs_auth or error.
  "status" VARCHAR NOT NULL DEFAULT 'pending',
  "status_message" VARCHAR NOT NULL DEFAULT '',
  "synced_at" TIMESTAMPTZ,
  "is_enabled" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mcp_servers_org_name ON "mcp_servers" ("organization_id", "name");
