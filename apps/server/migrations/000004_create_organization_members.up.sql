-- Who belongs to an organization. A user can belong to many organizations;
-- the creator is its owner.
CREATE TABLE IF NOT EXISTS "organization_members" (
  "organization_id" UUID NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "role" VARCHAR NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("organization_id", "user_id")
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON "organization_members" ("user_id");
