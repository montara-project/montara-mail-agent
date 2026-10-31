-- A global provider deleted on the way up does not come back: the platform one
-- stays the platform one.
DROP INDEX IF EXISTS uq_llm_providers_scope;
ALTER TABLE "llm_providers" ADD COLUMN IF NOT EXISTS "platform_user" BOOLEAN NOT NULL DEFAULT false;
UPDATE "llm_providers" SET "platform_user" = true WHERE "organization_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_providers_scope
  ON "llm_providers" ("organization_id", "platform_user") NULLS NOT DISTINCT;
