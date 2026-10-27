-- Skills the AI agent runs on mail. The built-in ones (summarize, organize,
-- draft_reply) are defined in code: their row, made on the first change, only
-- holds the organization's on/off switch and agent bot. A custom skill
-- (builtin is null) carries its own name and instruction. Either kind may name
-- the agent bot whose persona runs it.
CREATE TABLE IF NOT EXISTS "agent_skills" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "organization_id" UUID NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "builtin" VARCHAR(32),
  "name" VARCHAR(100) NOT NULL DEFAULT '',
  "description" VARCHAR(300) NOT NULL DEFAULT '',
  "instruction" TEXT NOT NULL DEFAULT '',
  "agent_bot_id" UUID REFERENCES "agent_bots" ("id") ON DELETE SET NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "deleted_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_org
  ON "agent_skills" ("organization_id", "created_at") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_skills_org_builtin
  ON "agent_skills" ("organization_id", "builtin") WHERE "builtin" IS NOT NULL;
