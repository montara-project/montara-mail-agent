-- A provider is an organization's own or the platform one (organization_id
-- NULL), which every user of every organization without its own uses. The
-- separate global scope is gone: a global provider becomes the platform one,
-- unless there already is one.
DELETE FROM "llm_providers"
WHERE "organization_id" IS NULL AND NOT "platform_user"
  AND EXISTS (SELECT 1 FROM "llm_providers" WHERE "platform_user");
DROP INDEX IF EXISTS uq_llm_providers_scope;
ALTER TABLE "llm_providers" DROP COLUMN IF EXISTS "platform_user";
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_providers_scope
  ON "llm_providers" ("organization_id") NULLS NOT DISTINCT;
