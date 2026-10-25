-- One action a user took: signing in, changing their account, or working in
-- an organization. Rows are written after the fact and never updated.
CREATE TABLE IF NOT EXISTS "activity_logs" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT uuidv7(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "user_id" UUID REFERENCES "users" ("id"),
  "organization_id" UUID REFERENCES "organizations" ("id") ON DELETE SET NULL,
  "action" VARCHAR NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "ip" VARCHAR,
  "user_agent" VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON "activity_logs" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_organization ON "activity_logs" ("organization_id", "created_at" DESC);
