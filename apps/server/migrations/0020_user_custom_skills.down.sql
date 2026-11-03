DROP INDEX IF EXISTS idx_agent_skills_user;
ALTER TABLE "agent_skills" DROP CONSTRAINT IF EXISTS ck_agent_skills_owner;

-- A custom skill goes back to the oldest live organization its user owns.
UPDATE "agent_skills" s
SET "organization_id" = (
  SELECT o."id" FROM "organizations" o
  JOIN "organization_members" m ON m."organization_id" = o."id"
  WHERE m."user_id" = s."user_id" AND m."role" = 'owner' AND o."deleted_at" IS NULL
  ORDER BY o."created_at" LIMIT 1
)
WHERE s."builtin" IS NULL;

DELETE FROM "agent_skills" WHERE "organization_id" IS NULL;

ALTER TABLE "agent_skills" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "agent_skills" DROP COLUMN IF EXISTS "user_id";
