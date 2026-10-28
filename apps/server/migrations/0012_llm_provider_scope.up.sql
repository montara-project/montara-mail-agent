-- A provider is either an organization's own or the global one
-- (organization_id NULL), which every organization without its own uses.
-- Each gets an id, so it can move between the two, and a name to list it by.
-- NULLS NOT DISTINCT keeps one provider per organization and one global.
ALTER TABLE "llm_providers" DROP CONSTRAINT IF EXISTS "llm_providers_pkey";
ALTER TABLE "llm_providers" ADD COLUMN IF NOT EXISTS "id" UUID NOT NULL DEFAULT uuidv7();
ALTER TABLE "llm_providers" ADD PRIMARY KEY ("id");
ALTER TABLE "llm_providers" ADD COLUMN IF NOT EXISTS "name" VARCHAR NOT NULL DEFAULT '';
ALTER TABLE "llm_providers" ALTER COLUMN "organization_id" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_providers_scope
  ON "llm_providers" ("organization_id") NULLS NOT DISTINCT;
