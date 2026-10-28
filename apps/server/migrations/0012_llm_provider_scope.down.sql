DELETE FROM "llm_providers" WHERE "organization_id" IS NULL;
DROP INDEX IF EXISTS uq_llm_providers_scope;
ALTER TABLE "llm_providers" DROP CONSTRAINT IF EXISTS "llm_providers_pkey";
ALTER TABLE "llm_providers" DROP COLUMN IF EXISTS "id";
ALTER TABLE "llm_providers" DROP COLUMN IF EXISTS "name";
ALTER TABLE "llm_providers" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "llm_providers" ADD PRIMARY KEY ("organization_id");
