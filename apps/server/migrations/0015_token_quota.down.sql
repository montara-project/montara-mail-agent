DROP TABLE IF EXISTS "token_topups";
DROP TABLE IF EXISTS "token_balances";
DROP TABLE IF EXISTS "token_usage";
DROP INDEX IF EXISTS uq_llm_providers_scope;
ALTER TABLE "llm_providers" DROP COLUMN IF EXISTS "platform_user";
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_providers_scope ON "llm_providers" ("organization_id") NULLS NOT DISTINCT;
ALTER TABLE "users" DROP COLUMN IF EXISTS "plan";
