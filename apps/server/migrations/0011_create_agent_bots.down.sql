ALTER TABLE "agent_drafts" DROP COLUMN IF EXISTS "agent_bot_id";
DROP INDEX IF EXISTS uq_agent_bots_org_default;
DROP INDEX IF EXISTS idx_agent_bots_org;
DROP TABLE IF EXISTS "agent_bots";
