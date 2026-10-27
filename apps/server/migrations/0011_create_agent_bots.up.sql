-- User-defined AI agent personas: who the agent is (soul), what it should
-- remember (memory), how it writes (style) and what it must or must not do
-- (instruction). The system prompt is composed from these at runtime, never
-- stored; at most one live bot per organization may be the default, which the
-- background auto-drafter uses.
CREATE TABLE IF NOT EXISTS "agent_bots" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "organization_id" UUID NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(300) NOT NULL DEFAULT '',
  "soul" TEXT NOT NULL DEFAULT '',
  "memory" TEXT NOT NULL DEFAULT '',
  "style" TEXT NOT NULL DEFAULT '',
  "instruction" TEXT NOT NULL DEFAULT '',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_bots_org
  ON "agent_bots" ("organization_id", "created_at" DESC) WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_bots_org_default
  ON "agent_bots" ("organization_id") WHERE "is_default" AND "deleted_at" IS NULL;

-- Which persona drafted a queued reply, so the review queue can name it; a
-- deleted bot leaves the draft (and its text) standing.
ALTER TABLE "agent_drafts"
  ADD COLUMN IF NOT EXISTS "agent_bot_id" UUID REFERENCES "agent_bots" ("id") ON DELETE SET NULL;
