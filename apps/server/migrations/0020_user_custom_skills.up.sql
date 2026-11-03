-- A custom skill belongs to the user who made it, not to an organization: it
-- shows and runs in every organization they are a member of, and no other user
-- sees it. It names no agent bot, since a bot belongs to one organization; it
-- runs as the bot the user picks. A built-in skill's row stays an
-- organization's switch and bot.
ALTER TABLE "agent_skills" ADD COLUMN IF NOT EXISTS "user_id" UUID REFERENCES "users" ("id") ON DELETE CASCADE;
ALTER TABLE "agent_skills" ALTER COLUMN "organization_id" DROP NOT NULL;

-- An existing custom skill goes to the owner of the organization it was made in.
UPDATE "agent_skills" s
SET "user_id" = m."user_id", "organization_id" = NULL, "agent_bot_id" = NULL
FROM "organization_members" m
WHERE s."builtin" IS NULL AND m."organization_id" = s."organization_id" AND m."role" = 'owner';

-- One whose organization has no owner has no one to go to.
DELETE FROM "agent_skills" WHERE "builtin" IS NULL AND "user_id" IS NULL;

ALTER TABLE "agent_skills" DROP CONSTRAINT IF EXISTS ck_agent_skills_owner;
ALTER TABLE "agent_skills" ADD CONSTRAINT ck_agent_skills_owner CHECK (
  ("builtin" IS NULL AND "user_id" IS NOT NULL AND "organization_id" IS NULL AND "agent_bot_id" IS NULL)
  OR ("builtin" IS NOT NULL AND "organization_id" IS NOT NULL AND "user_id" IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_user
  ON "agent_skills" ("user_id", "created_at") WHERE "deleted_at" IS NULL AND "builtin" IS NULL;
