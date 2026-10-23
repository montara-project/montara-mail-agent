CREATE TABLE IF NOT EXISTS "organizations" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ,
  "name" VARCHAR NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON "organizations" ("created_at");
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON "organizations" ("deleted_at");
CREATE INDEX IF NOT EXISTS idx_organizations_name ON "organizations" ("name");